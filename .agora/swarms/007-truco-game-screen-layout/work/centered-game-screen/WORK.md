---
schema: "agora/work/v1"
id: "centered-game-screen"
swarm: "truco-game-screen-layout"
title: "Pantalla de juego centrada y responsive"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"game-centering":"Marcador, mesa, cabecera y controles comparten un contenedor centrado de hasta 1440 px","game-responsive":"La pantalla de juego usa una columna completa en movil y escala la mesa sin overflow ni huecos laterales","game-verification":"Tests, lint, build y E2E pasan y la evidencia queda registrada"}
satisfied-criteria: ["game-centering","game-responsive","game-verification"]
criterion-statuses: {"game-centering":["satisfied"],"game-responsive":["satisfied"],"game-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Pantalla de juego centrada y responsive

## Description

Extender la misma spec para centrar la mesa de juego, usar el ancho disponible sin dejar un vacio lateral y preservar la composicion mobile-first

## Acceptance criteria

- [x] **game-centering:** Marcador, mesa, cabecera y controles comparten un contenedor centrado de hasta 1440 px; stages: satisfied
- [x] **game-responsive:** La pantalla de juego usa una columna completa en movil y escala la mesa sin overflow ni huecos laterales; stages: satisfied
- [x] **game-verification:** Tests, lint, build y E2E pasan y la evidencia queda registrada; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
