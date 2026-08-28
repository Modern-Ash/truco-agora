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
  step_mode) y devuelve el snapshot recién cuando la decisión quedó aplicada
  y la siguiente fue publicada. De este modo, al elegir una carta la respuesta
  ya la incluye en `played` y nunca expone el estado intermedio del gate.
- Snapshot: campos `pending_step: {player, kind, call?} | null`,
  `step_generation: int` y `table_events`. La generación cambia en cada
  transición del gate para que un cliente pueda distinguir dos pasos
  consecutivos del mismo jugador y tipo sin reiniciar el delay por cada poll.
  `table_events` conserva hasta 24 cantos/respuestas con `id` monotónico, de
  modo que un poll lento no pierda Envido, Falta Envido, Truco o sus escaladas.

## UI
- Lobby: checkbox "Ritmo controlado para espectador", habilitado solo cuando
  los 4 (o 2) asientos son "Agente LLM". Al convertir el último asiento en
  agente se activa automáticamente; si cualquier asiento vuelve a Humano,
  se desactiva y deshabilita.
- Mesa: el creador de una partida 100% LLM entra directamente como espectador,
  sin tener que ocupar el asiento de uno de los agentes. La consulta usa
  `spectator=true`: muestra las manos de todos los agentes, pero la API la
  rechaza si existe cualquier jugador web.
- Table: la vista de espectador usa un paño propio, sin reutilizar ni duplicar
  los slots de jugador. Los equipos quedan enfrentados y la zona central de
  la baza muestra una posición vigente por agente.
- Table: durante toda la partida step-mode mantiene un panel de control con
  altura reservada. Un `pending_step: null` transitorio actualiza el mensaje y
  deshabilita el botón, pero no desmonta el panel. En la vista de espectador
  el estado de preparación/resolución comparte la baza con un carril fijo de
  cantos, sin reemplazarlo ni agregar una franja de turno exterior:
  - Botón **"Siguiente movida"** (llama `/step` una vez).
  - Toggle **"Automático"**, activo por defecto en vista de espectador, con
    selector de delay entre cartas (1s / 2s / 4s). Las decisiones internas
    sin cambio visible avanzan en 200 ms. Se detiene al terminar la partida,
    al desactivar el toggle o al usar "Siguiente movida" para pasar a control
    manual.
  - Texto legible: "Próxima movida: {player} va a {kind}".

El dock se colapsa automáticamente al ancho de los controles durante
autoplay, resolución o preparación. Esos dos últimos estados se comunican
únicamente mediante el spinner dentro de `Baza en juego`; al pasar a manual
se expande si hay una decisión concreta y muestra jugador/tipo.

## Fuera de alcance
- Deshacer una movida ya liberada.
- Editar/vetar la decisión del agente antes de aplicarla (el espectador
  controla *cuándo*, no *qué*, se decide — el LLM sigue decidiendo el
  contenido de la movida).
- step_mode combinado con jugadores humanos.

## Criterios de aceptación
- `step-gate`, `step-endpoint`, `scope-guard`, `spectator-ui` — ver work item.
