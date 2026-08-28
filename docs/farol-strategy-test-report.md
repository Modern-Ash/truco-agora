# Swarm 031 — informe de verificación

Fecha: 2026-08-27

## Resultados

- Suite de dominio y motor: `102 passed`.
- Pruebas del controlador LLM: `11 passed`.
- Suite web: `81 passed`.
- Build web de producción: exitoso (`vite build`, 33 módulos).
- Smoke test directo de creación de partida: el `bluff_level` seleccionado
  llega al snapshot público del agente.
- `git diff --check`: sin errores.

## Cobertura específica

- El prompt incluye una guía explícita de farol y su riesgo.
- Los tres perfiles producen instrucciones distintas.
- Un nivel inválido cae a `equilibrado` dentro del controlador y la API lo
  rechaza en su frontera pública.
- El prompt recibe el historial visible de cantos.
- El agente nunca recibe cartas ocultas del rival.
- El Lobby envía el perfil elegido por asiento.

La suite HTTP basada en `TestClient` queda fuera del conteo del motor porque se
bloquea en este entorno Python 3.14; la frontera usada por esta feature se
verificó con una invocación directa y la suite de interfaz cubre el payload.
