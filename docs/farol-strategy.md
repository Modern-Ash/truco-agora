# Estrategia de farol para agentes LLM

## Hallazgo

El engaño no es un desvío de las reglas del Truco Argentino: es parte de su
estrategia. La página oficial de los Juegos Evita caracteriza el juego por
articular engaño y mentiras para ganar. El reglamento bonaerense 2026 explica
que se envida y revida sin cartas fuertes para intimidar al rival y describe
esa práctica como el «alma» del juego. Un reglamento de torneo de AMEPORT
también destaca el diálogo y el engaño en la estrategia de pareja.

Fuentes consultadas:

- https://www.argentina.gob.ar/turismoydeportes/juegosevita/truco
- https://juegos.gba.gob.ar/wp-content/uploads/2026/reglamentos/especificos/deportes_adultos_mayores/truco.pdf
- https://www.ameport.org.ar/piezas/truco/reglamentotruco.pdf
- https://truco.ar/reglas

## Límite reglamentario

Farolear significa abrir o subir un canto legal sin tener una mano fuerte que
lo respalde. No significa inventar el número declarado una vez aceptado el
envido: el tanto ganador debe poder probarse con las cartas. El motor sigue
resolviendo el resultado real y entrega al agente únicamente opciones legales.

## Implementación

Cada agente tiene un `bluff_level`:

- `cauteloso`: reserva el farol para situaciones puntuales.
- `equilibrado`: evalúa marcador, cartas visibles e historial de cantos.
- `mentiroso`: aplica presión con mayor frecuencia, siempre como riesgo
  calculado.

`LLMController._prompt()` incorpora el perfil, el límite reglamentario y el
historial visible de cantos. La API valida el nivel y el Lobby permite elegirlo
por asiento. No se modificó el motor para hacer legales acciones nuevas.
