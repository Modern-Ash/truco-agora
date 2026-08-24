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
   (`mock`/`claude`/`codex`/`opencode`/`ollama`, default `mock`) + input de
   modelo opcional.
2. **Por asiento**: cada jugador pasa de ser un simple input de nombre a un
   bloque con: nombre, tipo (`Humano`/`Agente LLM`), y si es agente:
   proveedor + modelo (mismo set que el motor, independiente por asiento).

## Diseño de estado
`players` pasa de `string[]` a
`{name, kind: "web"|"agent", provider, model}[]`. `crear()` mapea esto
directo a `PlayerSpec[]` en el payload de `createMatch`.

## Fuera de alcance
- Persistir configuración entre sesiones más allá de lo que ya hace
  `localStorage` para revancha.
- Validar en el frontend que el proveedor/modelo elegido existe realmente
  (la API ya devuelve 422 si el proveedor es inválido; el frontend solo
  necesita mostrar ese error, patrón ya existente).

## Criterios de aceptación
- `engine-selector`, `seat-selector`, `api-wiring`, `tests` — ver work item.
