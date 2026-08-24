# Spec: Modo espectador paso a paso (partidas 100% LLM)

Work item: `truco-step-mode/spectator-step-mode`.

## Problema
Cuando todos los jugadores de una partida son agentes LLM, el motor corre
libre en el hilo de la sesión: cada decisión se calcula y aplica en cuanto
el `LLMController` responde, sin ningún punto de pausa. Un espectador
humano no tiene forma de "seguir" la partida a un ritmo legible — solo ve
el resultado final o un estado que cambia de golpe entre polls.

## Diseño
Reutiliza el patrón ya probado de `WebController` (bloqueo con
`threading.Event`, consumido desde la capa HTTP), pero en vez de esperar
la decisión de un humano, bloquea la ejecución del agente hasta que un
espectador pide explícitamente la siguiente movida.

### `StepGate`
Un torniquete simple: `wait()` bloquea hasta que `open()` se llama una vez
(auto-reset para la siguiente espera). Un `StepGate` por partida, compartido
por todos los jugadores agente en modo paso a paso — como el motor corre
en un único hilo por partida (`MatchSession.thread`), no hay condición de
carrera: cuando un agente se bloquea, el hilo entero de la partida se
detiene ahí hasta el próximo `/step`.

### `SteppedController`
Envuelve cualquier `PlayerController` (típicamente `LLMController`).
Antes de delegar cada uno de los 4 métodos del protocolo
(`choose_action`, `choose_card`, `choose_call_response`,
`choose_face_down`), espera en el `StepGate` compartido. Publica en la
sesión qué jugador y qué tipo de decisión está pendiente
(`pending_step = {"player": ..., "kind": ...}`), igual que
`WebController.pending` publica la decisión pendiente de un humano.

Una "movida" = una llamada atómica al protocolo (una carta jugada, un
canto, una respuesta) — el mismo grano que ya percibe un jugador humano
en la UI existente, no un turno completo (que puede incluir varios
intercambios de cantos antes de llegar a jugar una carta).

## API
- `CreateMatchRequest.step_mode: bool = False`. Si es `true`, valida que
  **todos** los jugadores sean `kind="agent"` (422 si no) — el modo paso a
  paso no tiene sentido con un jugador humano, que ya pausa la partida
  naturalmente esperando su HTTP.
- `POST /matches/{id}/step`: libera la próxima decisión pendiente (404 si
  no hay ninguna esperando, ej. si la partida ya terminó o no es
  step_mode) y devuelve el snapshot actualizado tras resolverse esa
  decisión.
- Snapshot: nuevo campo `pending_step: {player, kind} | null`.

## UI
- Lobby: checkbox "Modo paso a paso (espectador)", habilitado solo cuando
  los 4 (o 2) asientos son "Agente LLM". Si se cambia cualquier asiento a
  Humano, se desactiva y deshabilita automáticamente.
- Table: cuando `state.pending_step` no es null, panel de control con:
  - Botón **"Siguiente movida"** (llama `/step` una vez).
  - Toggle **Auto-play** con selector de delay (1s / 2s / 4s) — llama
    `/step` automáticamente en un intervalo, simulando el tiempo que
    tomaría una decisión humana. Se detiene solo al terminar la partida
    o al desactivar el toggle.
  - Texto legible: "Próxima movida: {player} va a {kind}".

## Fuera de alcance
- Deshacer una movida ya liberada.
- Editar/vetar la decisión del agente antes de aplicarla (el espectador
  controla *cuándo*, no *qué*, se decide — el LLM sigue decidiendo el
  contenido de la movida).
- step_mode combinado con jugadores humanos.

## Criterios de aceptación
- `step-gate`, `step-endpoint`, `scope-guard`, `spectator-ui` — ver work item.
