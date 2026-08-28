---
schema: "agora/work/v1"
id: "rules-and-mobile-table"
swarm: "truco-rules-mobile-cards"
title: "Reglas verificadas y experiencia mobile-first"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"rules-audit":"Las reglas implementadas se contrastan con fuentes argentinas y las variantes quedan expl\u00edcitas","core-rules":"Jerarqu\u00eda de cartas, bazas por equipo, envites y escalado de truco respetan el reglamento y tienen pruebas","flor-variant":"La partida permite elegir sin flor o con flor y el motor/API/UI respetan esa elecci\u00f3n","mobile-lobby":"El inicio queda centrado, mobile-first, accesible y sin overflow en 320 px","spanish-deck":"Manos y bazas usan cartas espa\u00f1olas ornamentadas, legibles y consistentes en todos los tama\u00f1os","verification":"Backend, frontend, build, lint y E2E pasan y producen evidencia durable"}
satisfied-criteria: ["rules-audit","core-rules","flor-variant","mobile-lobby","spanish-deck","verification"]
criterion-statuses: {"rules-audit":["satisfied"],"core-rules":["satisfied"],"flor-variant":["satisfied"],"mobile-lobby":["satisfied"],"spanish-deck":["satisfied"],"verification":["satisfied"]}
required-artifacts: ["spec","implementation-plan","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Reglas verificadas y experiencia mobile-first

## Description

Auditar reglas contra fuentes argentinas, corregir el motor y renovar lobby y cartas españolas.

## Acceptance criteria

- [x] **rules-audit:** Las reglas implementadas se contrastan con fuentes argentinas y las variantes quedan explícitas; stages: satisfied
- [x] **core-rules:** Jerarquía de cartas, bazas por equipo, envites y escalado de truco respetan el reglamento y tienen pruebas; stages: satisfied
- [x] **flor-variant:** La partida permite elegir sin flor o con flor y el motor/API/UI respetan esa elección; stages: satisfied
- [x] **mobile-lobby:** El inicio queda centrado, mobile-first, accesible y sin overflow en 320 px; stages: satisfied
- [x] **spanish-deck:** Manos y bazas usan cartas españolas ornamentadas, legibles y consistentes en todos los tamaños; stages: satisfied
- [x] **verification:** Backend, frontend, build, lint y E2E pasan y producen evidencia durable; stages: satisfied

## Required artifacts

- spec
- implementation-plan
- source-code
- test-report
