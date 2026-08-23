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

### `POST /matches`
Crea una partida.
```json
{
  "mode": "1v1 | 2v2",
  "target_score": 15 | 30,
  "players": [
    {"name": "A", "kind": "web"},
    {"name": "B", "kind": "agent", "seed": 7}
  ]
}
```
- `players`: 2 (1v1) o 4 (2v2), alternando equipos en el orden dado
  (posición par = equipo 1, impar = equipo 2).
- `kind`: `web` (decide vía API) o `agent` (LLM mock determinístico).
- Respuesta `201`: `{match_id, players, target_score, state}`.

### `GET /matches/{id}/state?player=NOMBRE`
Estado **visible** para ese jugador: sus cartas, jugadas de todos
(público), marcador, quién es mano, nivel de truco vigente, ganador si
terminó, y si es su turno: `pending` con las opciones legales
(`jugar`, cantos disponibles, `irse_al_mazo`, respuestas `quiero`/
`no_quiero`/escalada). Si el jugador no existe → 404.

### `POST /matches/{id}/actions`
```json
{"player": "A", "action": "play_card", "card": {"palo": "oro", "numero": 7}}
```
Acciones según la decisión pendiente del jugador:
- `play_card` + `card` (debe estar en su mano) → equivale a `jugar`.
- `call`: `envido` (solo oferta inicial), `truco`, `retruco`, `vale_cuatro`,
  `irse_al_mazo`.
- `respond`: `quiero`, `no_quiero`, o contracanta (`real_envido`,
  `falta_envido`, `retruco`, `vale_cuatro`) cuando corresponda.

Errores:
- `409`: no hay decisión pendiente para ese jugador (no es su turno).
- `422`: acción ilegal o inválida (carta fuera de mano, canto no permitido,
  respuesta inexistente) con motivo en el body.
- `404`: partida inexistente.

Respuesta: estado visible actualizado del jugador.

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
