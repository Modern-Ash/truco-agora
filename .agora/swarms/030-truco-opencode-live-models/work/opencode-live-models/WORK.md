---
schema: "agora/work/v1"
id: "opencode-live-models"
swarm: "truco-opencode-live-models"
title: "Cat\u00e1logo vivo de modelos OpenCode"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"live-opencode-catalog":"Los combos muestran los modelos devueltos por opencode models --pure","shared-catalog-source":"Motor y asientos consumen una \u00fanica fuente viva sin cach\u00e9 obsoleta","selected-opencode-model-flow":"El modelo seleccionado se env\u00eda y persiste en la partida","opencode-catalog-verification":"Pruebas, build, lint, endpoint real y E2E verifican el cat\u00e1logo"}
satisfied-criteria: ["live-opencode-catalog","shared-catalog-source","selected-opencode-model-flow","opencode-catalog-verification"]
criterion-statuses: {"live-opencode-catalog":["satisfied"],"shared-catalog-source":["satisfied"],"selected-opencode-model-flow":["satisfied"],"opencode-catalog-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Catálogo vivo de modelos OpenCode

## Description

Eliminar la caché paralela del selector y compartir el catálogo real del Lobby entre motor y asientos

## Acceptance criteria

- [x] **live-opencode-catalog:** Los combos muestran los modelos devueltos por opencode models --pure; stages: satisfied
- [x] **shared-catalog-source:** Motor y asientos consumen una única fuente viva sin caché obsoleta; stages: satisfied
- [x] **selected-opencode-model-flow:** El modelo seleccionado se envía y persiste en la partida; stages: satisfied
- [x] **opencode-catalog-verification:** Pruebas, build, lint, endpoint real y E2E verifican el catálogo; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
