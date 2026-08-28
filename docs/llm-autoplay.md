# Spec: ritmo controlado para partidas LLM vs LLM

## Objetivo

Una partida cuyos asientos son todos agentes debe poder observarse desde el
inicio. El espectador puede dejarla avanzar automáticamente con un delay
configurable o pausar y liberar una decisión por vez.

## Comportamiento

- Al convertir el último asiento en agente, el Lobby activa `step_mode`.
- Al crear la partida, el creador entra a Mesa como espectador y no elige un
  asiento reservado a un agente.
- La vista de espectador muestra una mesa de truco: equipos enfrentados sobre
  un paño central, manos completas en cada cabecera y cartas jugadas en el
  centro. El backend solo habilita esta revelación si la partida no contiene
  jugadores web.
- La zona central de la baza permanece visible antes de la primera jugada:
  reserva tres posiciones por agente y reemplaza cada posición por la carta
  correspondiente a medida que avanza la mano.
- Si el frontend encuentra una API anterior que todavía no agrega `hand` al
  snapshot de espectador, reconstruye las manos desde las vistas individuales
  de los agentes. Esto permite actualizar la web sin dejar la mesa vacía
  mientras el proceso local del backend sigue ejecutando la versión anterior.
- El autoplay comienza activo con 2 segundos entre cartas. Las opciones
  disponibles son 1, 2 y 4 segundos; un segundo es el mínimo. Las decisiones
  internas sin cambio visible en la baza (elegir acción o responder un canto)
  avanzan en 200 ms.
- "Siguiente movida" desactiva autoplay y libera una única decisión.
- El backend expone `step_generation`, contador monotónico usado para
  reprogramar el próximo delay incluso si jugador y tipo se repiten.
- `POST /step` responde recién cuando la decisión quedó aplicada y se publicó
  la siguiente; nunca devuelve el estado intermedio donde `pending_step` ya
  desapareció pero la carta aún no ingresó a `played`.
- Los agentes `mock` sin semilla —la configuración predeterminada del Lobby—
  eligen la primera opción legal, por lo que priorizan `jugar` y colocan cartas
  en vez de encadenar abandonos aleatorios. Una semilla explícita conserva la
  selección pseudoaleatoria reproducible.
- El usuario puede desactivar `step_mode` antes de crear la partida si desea
  ejecución instantánea sin observación paso a paso.

## Criterios

- Entrada automática como espectador para el creador de una partida 100% LLM.
- Manos de todos los agentes visibles, sin duplicar jugadores en la mesa y
  sin exponer cartas en partidas con participantes web.
- Mesa responsive con equipos enfrentados y la baza claramente separada de
  las manos.
- Autoplay activo por defecto, configurable y pausable.
- Avance manual de exactamente una decisión.
- Continuidad ante pasos consecutivos con igual jugador y tipo.
- Sin regresiones en webapp, API ni motor.
