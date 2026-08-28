---
schema: "agora/work/v1"
id: "live-runtime-call-visibility"
swarm: "truco-live-runtime-call-visibility"
title: "Instancia activa con cantos y cartas visibles"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"runtime-version-warning":"La UI detecta y explica cuando la API no publica eventos de canto","non-obscuring-deal-layer":"Mezcla y reparto nunca ocultan manos, baza ni cantos","explicit-no-call-status":"El carril informa Sin cantos todav\u00eda antes del primer canto","live-server-verification":"Frontend y backend activos sirven y publican la implementaci\u00f3n actual"}
satisfied-criteria: ["runtime-version-warning","non-obscuring-deal-layer","explicit-no-call-status","live-server-verification"]
criterion-statuses: {"runtime-version-warning":["satisfied"],"non-obscuring-deal-layer":["satisfied"],"explicit-no-call-status":["satisfied"],"live-server-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Instancia activa con cantos y cartas visibles

## Description

Detectar backend obsoleto, ordenar capas de reparto y explicar el estado sin cantos

## Acceptance criteria

- [x] **runtime-version-warning:** La UI detecta y explica cuando la API no publica eventos de canto; stages: satisfied
- [x] **non-obscuring-deal-layer:** Mezcla y reparto nunca ocultan manos, baza ni cantos; stages: satisfied
- [x] **explicit-no-call-status:** El carril informa Sin cantos todavía antes del primer canto; stages: satisfied
- [x] **live-server-verification:** Frontend y backend activos sirven y publican la implementación actual; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
