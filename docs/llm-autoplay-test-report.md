# Verificación de autoplay LLM vs LLM

Fecha: 2026-08-25

- `npm test`: 3 archivos, 45 pruebas aprobadas. Incluye la recuperación de
  manos cuando el frontend se conecta a una API anterior, los placeholders
  permanentes de la baza, su reemplazo por cartas jugadas y el avance rápido
  de decisiones internas en autoplay.
- `.venv/bin/pytest -q`: 114 pruebas aprobadas. Incluye la regresión que exige
  que `/step` devuelva la carta ya aplicada en `played`, que el mock sin
  semilla priorice `jugar` y que una semilla mantenga una secuencia reproducible.
- `npm run build`: aprobado.
- `npm run lint`: aprobado, con 3 advertencias conocidas de Fast Refresh.
- `npm run e2e`: aprobado; usando agentes mock sin semilla como los crea el
  Lobby, verificó manos visibles, avance de `step_generation`, una carta
  efectivamente visible en `played` y una partida HTTP completa.
- `git diff --check`: aprobado.

La inspección con navegador integrado no estuvo disponible porque la sesión
no tenía ningún navegador conectado. La estructura visual se verificó con
pruebas DOM: paño central, zona de baza con posiciones permanentes, tres cartas
por agente y controles en un solo bloque responsive. El rediseño posterior
responde además a las capturas reales aportadas por el usuario.
