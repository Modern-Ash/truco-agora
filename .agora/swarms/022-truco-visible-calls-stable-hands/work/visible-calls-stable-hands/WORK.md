---
schema: "agora/work/v1"
id: "visible-calls-stable-hands"
swarm: "truco-visible-calls-stable-hands"
title: "Cantos visibles y manos de geometr\u00eda estable"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"step-call-metadata":"El paso pendiente conserva el canto concreto hasta el snapshot HTTP","visible-call-announcement":"La baza anuncia canto y respondedor y conserva la confirmaci\u00f3n tras resolver","stable-hand-geometry":"Cada puesto reserva tres lugares sin redimensionar el pa\u00f1o al jugar cartas","call-hand-verification":"Pruebas backend, frontend, lint, build y E2E verifican la correcci\u00f3n"}
satisfied-criteria: ["step-call-metadata","visible-call-announcement","stable-hand-geometry","call-hand-verification"]
criterion-statuses: {"step-call-metadata":["satisfied"],"visible-call-announcement":["satisfied"],"stable-hand-geometry":["satisfied"],"call-hand-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Cantos visibles y manos de geometría estable

## Description

Propagar el canto pendiente, anunciarlo durante su resolución y reservar tres lugares de carta por jugador

## Acceptance criteria

- [x] **step-call-metadata:** El paso pendiente conserva el canto concreto hasta el snapshot HTTP; stages: satisfied
- [x] **visible-call-announcement:** La baza anuncia canto y respondedor y conserva la confirmación tras resolver; stages: satisfied
- [x] **stable-hand-geometry:** Cada puesto reserva tres lugares sin redimensionar el paño al jugar cartas; stages: satisfied
- [x] **call-hand-verification:** Pruebas backend, frontend, lint, build y E2E verifican la corrección; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
