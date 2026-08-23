# Spec: Motor de Truco Argentino (1v1)

Fuente: https://trucogame.com/pages/reglamento-de-truco-argentino

## Alcance
Motor + CLI jugable para una partida 1v1 (mano a mano) de Truco Argentino.
Flor y señas quedan documentadas pero **fuera de alcance de implementación** en
esta primera iteración (se listan como trabajo futuro).

## Mazo
- Español de 40 cartas (sin 8, 9, comodines).
- Se reparten 3 cartas por jugador.

## Ranking para Truco (de mayor a menor)
1. As de Espadas (Ancho de espada)
2. As de Bastos (Ancho de basto)
3. 7 de Espadas
4. 7 de Oros
5. Restantes 3s
6. Restantes 2s
7. Restantes Ases (Oro, Copa)
8. Restantes 7s (Copa, Basto)
9. Figuras: 12, 11, 10 (todas equivalentes)
10. Restantes 6s
11. Restantes 5s
12. Restantes 4s

## Ranking para Envido
- Cartas numéricas: valor facial (3♥ = 3).
- Figuras (10, 11, 12): 0 puntos.
- Dos cartas del mismo palo: suma de ambas + 20.
- Tres cartas del mismo palo (si se computa igual): las dos más altas + 20.
- Valores válidos anunciables: 0, 1-7, 20-33.

## Estructura de la mano
- Cada mano tiene 3 rondas ("bazas"); gana quien gane 2 de 3.
- El "mano" es el jugador a la derecha del dealer; inicia el reparto y el juego.
- Empate en una baza = "parda"; se resuelve según reglas de parda estándar
  (si hay parda en la primera baza, gana la mano quien gane la segunda o,
  si también empata, gana el mano; en la práctica: la parda cede la definición
  a la siguiente baza no empatada, y de persistir el empate gana el jugador mano).

## Fase de Envido
- Ocurre solo en la primera ronda, antes de jugar la primera carta de esa ronda
  (o antes de que ambos jugadores hayan jugado su primera carta).
- Cantos: `Envido` (2), `Real Envido` (3), `Falta Envido` (puntos que le faltan
  al equipo puntero para llegar a 30).
- Respuestas válidas: `Quiero`, `No Quiero` (1 punto para quien cantó),
  o escalar con el siguiente canto.
- Se pueden encadenar cantos (Envido + Envido, Envido + Real Envido, etc.)
  antes de que el resto acepte/rechace.

## Fase de Truco
- Sin cantos, la mano vale 1 punto (puntaje base).
- Cantos y escalada: `Truco` → `Retruco` → `Vale Cuatro`.
- Puntos si se acepta (`Quiero`): Truco = 2, Retruco = 3, Vale Cuatro = 4.
- Puntos si se rechaza (`No Quiero`): se otorgan los del nivel anterior
  (rechazar Truco = 1, rechazar Retruco = 2, rechazar Vale Cuatro = 3).
- Cada canto requiere `Quiero`/`No Quiero` del rival antes de continuar
  jugando, o el rival puede re-escalar al siguiente nivel.
- Fuente validada contra: trucogame.com, bureaudejuegos.com y
  es.wikipedia.org/wiki/Truco_argentino (los tres coinciden en esta escala).

## Resolución de pardas (empates de ronda)
Regla real, más matizada que "gana 2 de 3 rondas":
- Si un jugador gana 2 rondas (seguidas o no, salvo el caso de parda
  intermedia descrito abajo), gana la mano.
- Una parda **hereda** el resultado de la ronda anterior: si alguien ganó
  la 1ª ronda y la 2ª es parda, gana la mano quien ganó la 1ª.
- Si la 1ª ronda es parda, decide la 2ª (si no empata también); si la 2ª
  también empata, decide la 3ª.
- Si la 1ª y la 2ª ronda las gana cada jugador (una y una), decide la 3ª;
  si la 3ª también es parda, gana quien ganó la 1ª ronda.
- Si las tres rondas empatan, gana el jugador **mano**.

## Irse al mazo
- Un jugador puede abandonar la mano en cualquier momento.
- Si ocurre antes de resolverse el Envido: pierde 1 punto de Envido (si se
  había cantado) + 1 punto de Truco.
- Si ocurre después del Envido: pierde solo el punto de Truco en juego.

## Fin de partida
- Configurable: 15 puntos ("una vuelta corta") o 30 puntos (estándar,
  dividido en "malas" 0-14 y "buenas" 15-29).
- Gana el primer equipo/jugador en alcanzar el objetivo.

## Fuera de alcance (documentado, no implementado)
- Flor / Contra Flor / Contra Flor al Resto.
- Señas (comunicación no verbal entre compañeros) — no aplica a 1v1.
- Modalidades 2v2 y 3v3.

## Jugadores: humano o agente
- El motor es agnóstico a quién decide las jugadas: cada `Player` delega en
  una estrategia (`PlayerController`) intercambiable.
- Controladores soportados en esta iteración:
  - `HumanController`: pide inputs por stdin/CLI.
  - `LLMController`: recibe el estado visible de la mano (sus cartas, cartas
    jugadas, cantos vigentes, puntaje) y decide vía un cliente LLM inyectado
    (interfaz `LLMClient`, implementación real o mock/determinística para
    tests). El motor nunca expone las cartas del rival al controlador.
- Una partida puede combinar libremente: humano vs humano, humano vs agente,
  o agente vs agente (para simulaciones/demos).
- El motor valida cada decisión contra las reglas antes de aplicarla,
  sin importar el origen (humano o LLM) — un LLM no puede hacer jugadas
  ilegales.

## Componentes a construir
1. **Modelo de dominio**: `Card`, `Deck`, `Player`, `Hand`, `Match`.
2. **Motor de reglas**: ranking truco/envido, resolución de bazas y pardas,
   escalado de cantos (envido y truco), cálculo de puntaje, irse al mazo,
   condición de fin de partida.
3. **Controladores de jugador**: `PlayerController` (interfaz), `HumanController`
   (CLI), `LLMController` (agente LLM vía `LLMClient` inyectable).
4. **CLI**: partida interactiva configurable por jugador (humano o agente LLM),
   en la misma terminal.
5. **Tests**: cobertura de ranking, cálculo de envido, escalado de truco,
   pardas, condición de fin de partida, y decisiones de `LLMController` con
   un `LLMClient` mock/determinístico.

## Criterios de aceptación (trazados a work item `truco-spec-engine`)
- `spec-completa`: este documento cubre mazo, rankings, cantos y escalado,
  señas (documentadas), condiciones de fin de partida, y el modelo de
  jugador humano/agente.
- `motor-reglas`: implementación cubre reparto, envido, 3 bazas, parda,
  irse al mazo.
- `cli-jugable`: partida completa 1v1 jugable por CLI, con cada jugador
  configurable como humano o agente LLM.
- `tests-reglas`: suite automatizada sobre las reglas clave y sobre el
  controlador LLM (con mock).
