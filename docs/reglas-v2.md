# Spec: Reglas completas v2 (`reglas-completas-v2`)

Fuentes contrastadas: reglamento ASART enlazado por
[Juegos Nacionales Evita](https://www.argentina.gob.ar/turismoydeportes/juegosevita/truco),
[Juegos Bonaerenses 2026](https://juegos.gba.gob.ar/wp-content/uploads/2026/reglamentos/especificos/deportes_adultos_mayores/truco.pdf)
y el resumen ASART de [truco.ar](https://truco.ar/reglas). Cierra los gaps de
`spec.md` y explicita las variantes que esas fuentes tratan de forma distinta.

## 1. Envido a regla oficial

- **Cadenas acumulativas**: cada apuesta aceptada suma; al rechazar una se
  cobra lo ya aceptado (o **1** si no había nada aceptado).

  | Cadena | Quiero | No quiero |
  |---|---|---|
  | Envido | 2 | 1 |
  | Real Envido | 3 | 1 |
  | Envido + Envido | 4 | 2 |
  | Envido + Real Envido | 5 | 2 |
  | Envido + Envido + Real Envido | 7 | 4 |
  | (…+ Falta Envido) | faltante* | ídem sin falta |

- **Falta Envido**: aceptada → en *malas* gana el chico directo
  (puntos hasta el target); en *buenas*, el faltante del líder
  (`target - max(score)`). Rechazada → solo lo acumulado.
- **Cualquier jugador** puede iniciar el envido (turno desde el mano).
- Empate de envido → gana el equipo mano.

## 2. Flor (variante configurable)

La mesa es **sin flor** por defecto. Al crearla se puede activar la variante
**con flor**; no se mezclan ambas durante una partida.

- Con la variante activa, Flor = 3 cartas del mismo palo; su declaración es
  obligatoria y su valor es la suma de valores + 20
  (figuras valen 0). Se canta durante la primera ronda, antes del truco;
  **anula cualquier envite de envido pendiente o aceptado**.
- Resolución:
  - Un solo bando con flor → ese bando suma **3** (aunque ambos jugadores
    del bando tengan flor, total 3).
  - Ambos bandos con flor → duelo; el bando desafiado puede responder:
    - **Con flor quiero**: comparan flores → ganador **+4**.
    - **Contra flor**: si el otro bando quiere → comparan → **+6** al
      ganador; si no quiere → **+4** al cantante.
    - **Contra flor al resto**: quiero → ganador se lleva el *resto*
      (faltante del líder); no quiere → **+6** al cantante.
    - **Con flor me achico**: el bando que cantó primero suma **3**.
  - Empate de flores → gana el bando mano.
- La flor se resuelve antes que el truco: si alcanza el chico, termina.

## 3. Cartas tapadas

- Nueva acción legal al jugar carta: boca abajo.
- Valor: **pierde contra todas**, **empata solo contra otra tapada**
  (dos tapadas = parda entre ellas).
- Su cara no se revela: ni rivales vía estado/API ni prompt de agentes
  (aparece como "carta tapada").

## 4. Señas (webapp 2v2)

- Canal efímero compañero→compañero: `POST /matches/{id}/senas`
  `{from, to, sena}` validando mismo equipo.
- Entrega única: aparece en el próximo `GET state` del receptor
  (campo `senas`) y se elimina. Catálogo cerrado de señas.
- UI: paleta de señas sobre el slot del compañero; toast al recibir.

## Criterios (trazados al work item)

`flor-motor`, `envido-oficial`, `tapadas`, `senas`, `web-v2`, `tests-v2`.
