# Corrección de integración de nombres por defecto (Swarm 002)

## Problema

El Lobby generaba dos nombres de equipo distintos y los entregaba a
`createMatch`, pero el adaptador HTTP de la webapp no incluía `team_names` en
el JSON enviado a `POST /matches`. Como consecuencia, el backend recibía el
campo como ausente y mostraba `Equipo 1` y `Equipo 2`.

## Alcance

- Conservar `team_names` al cruzar la frontera `Lobby -> api.js -> POST /matches`.
- Verificar que el backend usa ambos nombres y mantiene el comportamiento
  retrocompatible cuando el campo no está presente.
- Cubrir la serialización web y el flujo HTTP real con pruebas de regresión.

## Criterios de aceptación

- `payload-forwarded`: `createMatch` incluye `team_names` en el body JSON.
- `backend-custom-names`: `POST /matches` devuelve los nombres personalizados
  en el estado inicial.
- `no-regression`: pasan las suites web y Python, el build, el lint y el E2E
  de una partida completa.

## Semántica por modalidad

- En 1v1 no existe una colectividad separada: cada equipo usa directamente el
  nombre de su único jugador, aunque un cliente envíe `team_names`.
- La web también normaliza estados de partidas 1v1 ya creadas: marcador,
  cabeceras de la mesa, anuncio del ganador y selector de asiento muestran al
  participante aun cuando el estado conserve un nombre colectivo interno.
- En 2v2 el Lobby genera dos nombres colectivos distintos y el backend los
  conserva.
