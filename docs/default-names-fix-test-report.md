# Verificación de la corrección del Swarm 002

Fecha: 2026-08-25

## Resultados

- `npm test`: 4 archivos, 50 pruebas aprobadas.
- `.venv/bin/pytest -q`: 115 pruebas aprobadas.
- `npm run build`: build de Vite aprobado.
- `npm run lint`: aprobado, con 3 advertencias preexistentes de Fast Refresh.
- `npm run e2e`: aprobado; 1v1 usó `Ana`/`Beto` como equipos aunque recibió
  colectividades, 2v2 preservó `Rosario`/`Mendoza` y la partida HTTP terminó
  con ganador y puntaje objetivo.
- `git diff --check`: aprobado.

Las pruebas cubren la serialización del Lobby y la regla defensiva de la API:
1v1 nunca usa colectividades; 2v2 sí las conserva. El E2E verifica el contrato
contra una instancia real de uvicorn. También se cubre una partida 1v1 previa
que aún contiene nombres colectivos: el marcador, la mesa y el anuncio final
presentan los nombres de los participantes.
