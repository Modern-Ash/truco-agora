# Spec: Webapp React multijugador de Truco Argentino (`truco-webapp-v1`)

Fuente reglas: https://www.bureaudejuegos.com/reglas-truco/
Backend: la API REST por turnos (`truco/api.py`, spec en `docs/api-spec.md`).

## Decisiones

- **Stack**: React 18 + Vite (JS/JSX, sin TypeScript en v1). Sin librerías
  de UI: CSS puro con tema de mesa de cartas.
- **Multijugador**: multi-dispositivo por polling del estado
  (`GET /matches/{id}/state?player=NOMBRE`, intervalo 1 s). Cada navegador
  reclama un asiento de la partida; solo ve sus propias cartas porque el
  estado es por jugador.
- **Asientos**: la API crea todos los jugadores al crear la partida. El
  creador configura modo/target y nombres de asientos, comparte el link
  `/mesa?match=ID`; cada quien elige su asiento libre (queda guardado en
  localStorage). Los asientos sin reclamar se juegan como "esperando" y no
  muestran cartas a nadie salvo su dueño.
- **Reglas**: las ya implementadas en el motor/API. Flor y cartas tapadas
  quedan fuera de alcance (igual que en spec.md del motor).

## Vistas

### 1. Lobby (`/`)
- Elección de modalidad **1v1 / 2v2** y objetivo **15 / 30** puntos.
- Nombres de los asientos (por defecto "Jugador 1..4"), editable el propio.
- Botón **Crear partida** → POST /matches → muestra el match_id y un botón
  "Copiar invitación" (URL `/mesa?match=ID`).
- Campo para **pegar match_id o link** y unirse a una partida existente.

### 2. Selección de asiento (`/mesa?match=ID` sin asiento elegido)
- Muestra los asientos de la partida, cuáles están libres.
- Elegir uno guarda `localStorage["truco:seat:<match>"] = nombre`.

### 3. Mesa (`/mesa?match=ID&seat=NOMBRE`)
Vista cenital estilo paño verde:
- **Centro**: bazas de la mano actual — cada carta jugada aparece frente a
  su jugador; separación visual entre la baza anterior y la en curso;
  icono del mazo.
- **Indicadores**: chip "MANO" junto al jugador mano; resaltado del turno
  activo (jugador con decisión pendiente); banner con el canto vigente
  ("Cantan Envido", "Truco cantado — respondé").
- **Rivales**: arriba (1v1) o arriba y costados (2v2, compañero enfrente).
  Mostran dorso de carta por cada carta jugada en la baza actual.
- **Mano propia** (abajo): 3 cartas españolas renderizadas en CSS (palo +
  número), abanico; clic en una carta la juega si hay decisión pendiente
  (`POST /actions play_card`); deshabilitada fuera de turno.
- **Acciones contextuales** según `pending.options` de la API:
  - oferta: `Envido` / `Paso`
  - acción: `Truco` (+ escaladas si disponibles) / `Irse al mazo`
  - respuesta: `Quiero` / `No quiero` / contracantas legales
- **Marcador** (esquina, estilo pizarra): puntaje por equipo con zonas
  **malas/buenas** (0–14 / 15–29 a 30; 0–14 / 15 a 15), indicador de quién
  gana el chico.
- **Fin de partida**: overlay con ganador y botón **Revancha**
  (crea partida nueva con misma configuración).
- **Estado de conexión**: si el polling falla se muestra aviso; polling se
  reanuda solo.

## Flujo de referencia (criterio flujo completo)

1. A crea partida 1v1 a 15 → comparte link.
2. B abre el link, elige el otro asiento.
3. A ve oferta de envido → canta Envido; B ve banner → No quiere (+1 A).
4. Ambos juegan sus cartas por turnos hasta resolver la mano (bazas en el
   centro se van apilando por ronda).
5. Marcador refleja los puntos; siguiente mano reparte 3 nuevas cartas
   (mano alterna según API).

## Criterios de aceptación (trazados al work item `truco-webapp-v1`)

- `web-lobby`: lobby crea/participa partidas 1v1/2v2 a 15/30.
- `web-mesa-central`: vista cenital con bazas centrales, mazo, chips
  MANO/turno y banner de canto vigente.
- `web-reparto`: mano propia de 3 cartas jugables que pasan a la baza.
- `web-cantos`: acciones contextuales exactas desde `pending.options`.
- `web-marcador`: malas/buenas + anuncio de fin de chico + revancha.
- `web-multijugador`: dos navegadores sincronizados por polling, cada uno
  solo ve sus cartas.
- `tests-web`: Vitest+Testing Library para lobby/mesa/acciones con API
  mockeada + E2E de integración Node contra uvicorn real (lobby→carta→
  canto→mano completa).

## Fuera de alcance

- WebSocket/SSE (polling basta para v1), autenticación, persistencia,
  flor, cartas tapadas, sonidos.
