# Spec: Proveedores LLM pluggables (jugadores + referee)

Work item: `truco-llm-providers/llm-provider-plugins`.

## Contexto
Hoy `LLMController` (truco/controller.py) recibe un `LLMClient` inyectado con
un único método `decide(prompt, options) -> str`. La única implementación
real era `DeterministicMockLLMClient` (para tests/demo). Esta feature agrega
adaptadores reales para múltiples proveedores, seleccionables por
configuración, sin tocar el motor de reglas (`engine.py`) ni el contrato
`PlayerController`.

## Principio de diseño (no negociable)
**El LLM nunca decide reglas.** El motor sigue siendo la única fuente de
verdad: valida cada `Card`/canto/respuesta contra el estado legal antes de
aplicarla (igual que hoy). Los adaptadores LLM solo implementan
`decide(prompt, options) -> str`, eligiendo una opción de una lista ya
acotada por el motor. Esto aplica igual al nuevo rol `referee`: narra/reporta,
no arbitra.

## Adaptadores (`truco/llm_providers.py`, nuevo módulo)
Todos implementan el protocolo `LLMClient` existente. Cada uno shell-ea al
CLI correspondiente (mismo patrón que usa Agora para actores nativos:
`claude --print`, `codex exec`, etc.) — no se agregan SDKs de proveedor como
dependencia de Python, para no acoplar el proyecto a una librería por backend.

| Adaptador | Comando shelleado | Notas |
|---|---|---|
| `ClaudeCLIClient` | `claude --print --permission-mode bypassPermissions --model <m>` | Requiere `claude` en PATH |
| `CodexCLIClient` | `codex exec --model <m>` | Requiere `codex` en PATH |
| `OpenCodeCLIClient` | `opencode run --model <m>` | Requiere `opencode` en PATH |
| `OllamaClient` | HTTP local a `http://localhost:11434/api/generate` | No requiere shell-out; usa `urllib` (stdlib, sin dependencias nuevas) |

Cada adaptador:
1. Arma un prompt que incluye el `prompt` de contexto + las `options`
   válidas, pidiendo *exactamente una línea con una de las opciones*.
2. Parsea la respuesta: si no matchea ninguna opción válida, reintenta una
   vez con un prompt más estricto; si vuelve a fallar, **cae a la primera
   opción** (fail-safe determinista, nunca bloquea la partida) y lo loguea.
3. Tiene un `timeout` configurable (default 30s); si expira, mismo fallback.

## Selección de proveedor
`--llm-provider {claude,codex,opencode,ollama,mock}` en la CLI (`truco/cli.py`)
y variable de entorno `TRUCO_LLM_PROVIDER` como default. `mock` mantiene el
comportamiento actual (`DeterministicMockLLMClient`) para tests/CI sin
depender de ningún CLI externo instalado.

Factory: `build_llm_client(provider: str, **kwargs) -> LLMClient` en
`llm_providers.py`, usada tanto por jugadores agenticos como por el referee.

## Rol `referee` (nuevo, opcional)
Un `Referee` observa la partida (recibe los mismos snapshots que la webapp/API
expone) y usa un `LLMClient` pluggable para generar narración/comentario de
la mano ("Ana cantó truco con una mano fuerte..."). Vive fuera del bucle de
decisión del motor: se le pasa el estado *después* de cada jugada resuelta,
nunca antes. No tiene manera de influir en `Match`/`engine.py` — es
estrictamente un observador con salida de texto.

## Fuera de alcance
- Streaming de respuestas LLM.
- Autenticación/gestión de credenciales por proveedor (se asume que el CLI
  o el servidor local ya está autenticado/corriendo).
- Referee con memoria entre manos (cada narración es stateless sobre el
  snapshot actual).

## Criterios de aceptación
- `adapters`: 4 adaptadores implementados y testeados con el CLI/HTTP real
  mockeado (sin depender de tener los binarios instalados para correr tests).
- `config-pluggable`: flag CLI + env var, sin cambios en el motor.
- `referee-role`: `Referee` implementado, no puede alterar `Match`.
- `tests`: selección de proveedor, fallback por parseo fallido/timeout,
  aislamiento del referee frente al motor.
