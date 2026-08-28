---
schema: "agora/work/v1"
id: "durable-calls-stable-snapshots"
swarm: "truco-durable-calls-stable-snapshots"
title: "Eventos durables y snapshots visualmente estables"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"durable-table-events":"Cada canto y respuesta queda registrado con identidad monot\u00f3nica en el snapshot","independent-status-lanes":"Preparando jugada y el canto se muestran simult\u00e1neamente sin reemplazarse","transient-hand-retention":"Un snapshot transitorio vac\u00edo no borra cartas sin una jugada correlativa","durable-events-verification":"Pruebas backend, frontend, lint, build y E2E verifican eventos y manos"}
satisfied-criteria: ["durable-table-events","independent-status-lanes","transient-hand-retention","durable-events-verification"]
criterion-statuses: {"durable-table-events":["satisfied"],"independent-status-lanes":["satisfied"],"transient-hand-retention":["satisfied"],"durable-events-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Eventos durables y snapshots visualmente estables

## Description

Registrar cantos y respuestas, separarlos del spinner y retener manos ante snapshots transitorios incompletos

## Acceptance criteria

- [x] **durable-table-events:** Cada canto y respuesta queda registrado con identidad monotónica en el snapshot; stages: satisfied
- [x] **independent-status-lanes:** Preparando jugada y el canto se muestran simultáneamente sin reemplazarse; stages: satisfied
- [x] **transient-hand-retention:** Un snapshot transitorio vacío no borra cartas sin una jugada correlativa; stages: satisfied
- [x] **durable-events-verification:** Pruebas backend, frontend, lint, build y E2E verifican eventos y manos; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
