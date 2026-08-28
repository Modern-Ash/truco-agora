# Spec: UI de configuración (motor + proveedores por asiento)

Work item: `truco-config-ui/engine-and-config-ui`.

## Contexto
La API ya soporta todo lo necesario (`engine`, `engine_provider`, `engine_model`
en `CreateMatchRequest`; `kind`/`provider`/`model` en `PlayerSpec`), pero el
Lobby actual solo crea jugadores `web` (humano) y no expone el motor. Esta
feature es pura UI: cablear controles nuevos a campos que el backend ya
entiende, sin tocar `truco/api.py`.

## Controles nuevos en Lobby.jsx
1. **Motor de reglas**: toggle `Determinista` / `LLM` (default: LLM, igual
   que el default del backend). Si es LLM: selector de proveedor
   (`codex`/`claude`/`opencode`/`ollama`, default `codex`) + selector de
   modelos detectados y entrada manual opcional.
2. **Por asiento**: cada jugador pasa de ser un simple input de nombre a un
   bloque con: nombre, tipo (`Humano`/`Agente LLM`), y si es agente:
   proveedor + modelo (mismo set que el motor, independiente por asiento) y
   estilo de farol (`cauteloso`, `equilibrado` o `mentiroso`).

En 2v2, el bloque **Picardía de los agentes** permite alternar entre
configuración por jugador y por equipo. En el segundo modo, los asientos 1/3 y
2/4 heredan sus respectivos perfiles y el Lobby envía `team_bluff_levels` en
vez de duplicar valores individuales.

## Diseño de estado
`players` pasa de `string[]` a
`{name, kind: "web"|"agent", provider, model}[]`. `crear()` mapea esto
directo a `PlayerSpec[]` en el payload de `createMatch`.

## Descubrimiento de modelos (enmienda 2026-08-27)

`GET /llm/models` consulta el entorno real de la API y el Lobby muestra un
selector por proveedor. Si el catálogo no responde, la entrada manual sigue
disponible y se informa si falta el CLI o servicio. Cambiar de proveedor
descarta el identificador anterior para evitar combinaciones incompatibles.
`mock` se mantiene como adaptador interno y para pruebas, pero no aparece en
los combos destinados a seleccionar LLM reales. Claude y Codex incluyen
opciones conocidas de respaldo para que el combo no desaparezca mientras se
consulta la API.

Ollama es la excepción a la entrada manual: sólo se habilita si `/api/tags`
responde con modelos instalados, no ofrece un default implícito y permite
elegir únicamente esos tags. Los combos precargan los cuatro catálogos, pero
un fallo de catálogo no deshabilita Codex, Claude ni OpenCode: para esos CLIs
se conservan modelos conocidos o entrada manual. Sólo Ollama usa el catálogo
como preflight obligatorio.

## Fuera de alcance
- Persistir configuración entre sesiones más allá de lo que ya hace
  `localStorage` para revancha.
- Verificar por adelantado que un identificador manual de Claude, Codex u
  OpenCode tenga acceso en la cuenta externa; esa validación definitiva ocurre
  al invocar el proveedor. Ollama sí se valida contra sus tags locales.

## Criterios de aceptación
- `engine-selector`, `seat-selector`, `api-wiring`, `tests` — ver work item.
