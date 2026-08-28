# Swarm 032 — informe de verificación

Fecha: 2026-08-27

## Resultados

- Backend de dominio y configuración: `107 passed`.
- Frontend React: `82 passed`.
- Build de producción: exitoso (`vite build`, 33 módulos).
- Lint: exitoso, sin errores; conserva cuatro advertencias preexistentes de
  Fast Refresh.
- E2E HTTP: exitoso; completó una partida a 15 en 182 jugadas y verificó
  autoplay, cantos, cartas, señas y aislamiento de manos.
- `git diff --check`: sin errores.

## Cobertura del cambio

- Picardía individual y selector `Por jugador`.
- Picardía 2v2 por equipo con herencia 1/3 y 2/4.
- Precedencia del perfil individual sobre el perfil del equipo.
- Rechazo de modo, cardinalidad y valores de equipo inválidos.
- Persistencia del nivel efectivo y su alcance en el snapshot.
- Insignia de picardía visible junto al proveedor/modelo de cada agente.
- Controles con `fieldset`, grupos etiquetados y estado `aria-pressed`.
- Disposición móvil en una columna y grillas progresivas desde 520 px.

La inspección visual interactiva no pudo ejecutarse porque no había un
navegador conectado a la sesión. La estructura, estados y variantes visuales
quedaron cubiertos mediante pruebas DOM, build y reglas responsive.
