---
schema: "agora/work/v1"
id: "tally-scoreboard"
swarm: "truco-cerillos-scoreboard"
title: "Marcador tradicional de cinco cerillos"
state: "verifying"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"five-stick-groups":"Cada cinco puntos forma un cuadrado de cuatro cerillos cruzado por una diagonal","score-modes":"Partidas a 15 muestran tres grupos y partidas a 30 separan malas y buenas en franjas de quince","exact-accessible-score":"El n\u00famero exacto, nombre de equipo, zona y ganador siguen siendo legibles y accesibles","responsive-no-regression":"El marcador se adapta a la mesa y pasan pruebas web, build, lint y E2E"}
satisfied-criteria: ["five-stick-groups","score-modes","exact-accessible-score","responsive-no-regression"]
criterion-statuses: {"five-stick-groups":["satisfied"],"score-modes":["satisfied"],"exact-accessible-score":["satisfied"],"responsive-no-regression":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Marcador tradicional de cinco cerillos

## Description

Representar el puntaje de cada equipo con cerillos agrupados de a cinco, incluyendo malas y buenas.

## Acceptance criteria

- [x] **five-stick-groups:** Cada cinco puntos forma un cuadrado de cuatro cerillos cruzado por una diagonal; stages: satisfied
- [x] **score-modes:** Partidas a 15 muestran tres grupos y partidas a 30 separan malas y buenas en franjas de quince; stages: satisfied
- [x] **exact-accessible-score:** El número exacto, nombre de equipo, zona y ganador siguen siendo legibles y accesibles; stages: satisfied
- [x] **responsive-no-regression:** El marcador se adapta a la mesa y pasan pruebas web, build, lint y E2E; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
