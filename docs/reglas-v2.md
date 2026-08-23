# Spec: Reglas completas v2 (`reglas-completas-v2`)

Fuente: https://www.bureaudejuegos.com/reglas-truco/
Cierra los gaps de `spec.md` (flor y señas documentadas, no implementadas)
y ajusta el envido a la tabla oficial.

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

## 2. Flor

- Flor = 3 cartas del mismo palo; valor = suma de valores + 20
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
