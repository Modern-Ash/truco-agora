# Spec: API REST por turnos del motor de Truco (`truco-api-webapp`)

Objetivo: exponer el motor existente (`truco.engine.Match`) como API HTTP
stateful para consumir desde una webapp, sin duplicar reglas: toda decisión
pasa por los controladores del motor y se valida contra las reglas.

## Decisiones

- **Stack**: FastAPI + uvicorn (pydantic ya presente). Tests con `TestClient`.
- **Modelo**: REST por turnos con sesiones de partida **en memoria**
  (proceso único; persistencia queda fuera de alcance de esta iteración).
- **Ejecución**: cada partida corre el bucle del motor en un hilo propio;
  los jugadores web se conectan mediante `WebController`, un controlador que
  publica la decisión pendiente y se bloquea hasta que llega por HTTP.
  El motor nunca expone cartas rivales: el estado sale de `VisibleState`.

## Endpoints

### `GET /llm/models?provider=PROVEEDOR`

Devuelve el catálogo visible en el entorno de la API para `mock`, `claude`,
`codex`, `opencode` u `ollama`: disponibilidad, modelos, fuente, diagnóstico y
si admite un identificador manual. Codex y OpenCode consultan sus CLI locales;
Ollama consulta `/api/tags`; Claude publica aliases y permite un nombre
completo. No lee ni devuelve credenciales. Un proveedor inválido responde 422.
Al crear una partida, cada uso de Ollama debe indicar un tag publicado por
ese catálogo; servicio ausente, catálogo vacío, modelo omitido o tag no
instalado responden 422 antes de iniciar el hilo de sesión.

### `POST /matches`
Crea una partida.
```json
{
  "mode": "1v1 | 2v2",
  "target_score": 15 | 30,
  "flor_enabled": false,
  "players": [
    {"name": "A", "kind": "web"},
    {"name": "B", "kind": "agent", "seed": 7}
  ]
}
```
- `players`: 2 (1v1) o 4 (2v2), alternando equipos en el orden dado
  (posición par = equipo 1, impar = equipo 2).
- `kind`: `web` (decide vía API) o `agent` (LLM mock determinístico).
- `flor_enabled`: selecciona la variante de mesa. `false` por defecto (sin
  flor); con `true`, la flor es obligatoria para quien la tiene y anula el
  envido.
- Respuesta `201`: `{match_id, players, target_score, flor_enabled, state}`.

### `GET /matches/{id}/state?player=NOMBRE`
Estado **visible** para ese jugador: sus cartas, jugadas de todos
(público), marcador, quién es mano, nivel de truco vigente, ganador si
terminó, y si es su turno: `pending` con las opciones legales
(`jugar`, cantos disponibles, `irse_al_mazo`, respuestas `quiero`/
`no_quiero`/escalada). Si el jugador no existe → 404.

El snapshot también expone `engine_config` (`kind`, `provider`, `model`),
`step_mode` y, en cada participante agente,
`agent: {provider, model, bluff_level}`. `bluff_level` admite `cauteloso`,
`equilibrado` o `mentiroso` y regula la propensión del agente a abrir o subir
cantos como farol; no modifica las reglas ni permite declarar tantos falsos
después de aceptar un envido. Esta
metadata es pública y no contiene prompts, respuestas ni credenciales.

En partidas 2v2, `POST /matches` admite
`team_bluff_levels: [nivel_equipo_1, nivel_equipo_2]`. Un nivel individual en
`players[i].bluff_level` tiene precedencia; si falta, el agente hereda el valor
de su equipo según la paridad del asiento. El snapshot publica
`picardia_scope`, el nivel efectivo de cada agente y, cuando corresponde, el
`bluff_level` de cada equipo.
Si una mano se recupera de una excepción transitoria, publica temporalmente
`recovering: true` y `recovery_error`; la sesión reintenta hasta tres veces
antes de declarar un error fatal y nunca confunde esa recuperación con un
ganador.

### `POST /matches/{id}/actions`
```json
{"player": "A", "action": "play_card", "card": {"palo": "oro", "numero": 7}}
```
Acciones según la decisión pendiente del jugador:
- `play_card` + `card` (debe estar en su mano) → equivale a `jugar`.
- `call`: `envido`, `real_envido` o `falta_envido` como oferta inicial;
  `truco`, `retruco`, `vale_cuatro`,
  `irse_al_mazo`.
- `respond`: `quiero`, `no_quiero`, o contracanta (`real_envido`,
  `falta_envido`, `retruco`, `vale_cuatro`) cuando corresponda.

Errores:
- `409`: no hay decisión pendiente para ese jugador (no es su turno).
- `422`: acción ilegal o inválida (carta fuera de mano, canto no permitido,
  respuesta inexistente) con motivo en el body.
- `404`: partida inexistente.

Respuesta: estado visible actualizado del jugador.

### `GET /matches/{id}/diagnostics`

Devuelve el diagnóstico operativo seguro de una sesión: nombre y estado del
hilo, paso pendiente y su antigüedad, generación del modo paso, último evento
de progreso, recuperación y error terminal. Sirve para distinguir si
`Resolviendo jugada…` está esperando al proveedor, a una acción o a la apertura
del siguiente paso. No incluye manos, cartas, prompts, cuerpos HTTP ni
credenciales.

Todas las respuestas incluyen `X-Request-ID`. El cliente puede enviar ese
header para correlacionar una llamada con los eventos `http.request.start` y
`http.request.end`; si no lo envía, la API genera uno.

La salida del backend se configura con `TRUCO_LOG_LEVEL` (default `DEBUG`) y
`TRUCO_LOG_FILE` (default `logs/truco-backend-debug.log`), con rotación de
5 MiB y tres respaldos. `TRUCO_LOG_FILE=""` desactiva el archivo. Ejemplo:

```bash
TRUCO_LOG_LEVEL=DEBUG TRUCO_LOG_FILE=./truco-debug.log \
  .venv/bin/uvicorn truco.api:app --reload
```

Cada línea utiliza campos estables como `event`, `request_id`, `match_id`,
`player`, `phase` y `duration_ms`; nunca serializa el prompt ni el body.

## Criterios de aceptación (trazados al work item)

- `api-crear-partida`: POST /matches crea partida 1v1 o 2v2 con target
  configurable y devuelve id + estado inicial.
- `api-estado-visible`: GET /matches/{id}/state devuelve estado visible sin
  exponer cartas rivales (verificado por test).
- `api-acciones`: POST /matches/{id}/actions valida contra el motor;
  ilegal → 422 con motivo; fuera de turno → 409.
- `api-flujo-completo`: una partida completa se juega solo con HTTP hasta
  alcanzar el puntaje objetivo.
- `tests-api`: suite pytest cubre creación, visibilidad, ilegales y flujo
  completo.

## Fuera de alcance (esta iteración)

- Persistencia entre reinicios del proceso, autenticación de usuarios,
  WebSocket/SSE, salas múltiples por usuario.
