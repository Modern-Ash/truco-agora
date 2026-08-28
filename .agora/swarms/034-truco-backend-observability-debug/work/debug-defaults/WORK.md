---
schema: "agora/work/v1"
id: "debug-defaults"
swarm: "truco-backend-observability-debug"
title: "DEBUG visible por defecto"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"debug-default":"El backend inicia en DEBUG sin configuraci\u00f3n adicional","default-file":"Los eventos se escriben en logs/truco-backend-debug.log","safe-snapshots":"El polling produce snapshots DEBUG sin cartas ni prompts","tests-pass":"Tests y E2E permanecen verdes"}
satisfied-criteria: ["debug-default","default-file","safe-snapshots","tests-pass"]
criterion-statuses: {"debug-default":["satisfied"],"default-file":["satisfied"],"safe-snapshots":["satisfied"],"tests-pass":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# DEBUG visible por defecto

## Description

Extensión de docs/backend-observability-spec.md: DEBUG y archivo rotativo por defecto, snapshots seguros y arranque visible desde npm.

## Acceptance criteria

- [x] **debug-default:** El backend inicia en DEBUG sin configuración adicional; stages: satisfied
- [x] **default-file:** Los eventos se escriben en logs/truco-backend-debug.log; stages: satisfied
- [x] **safe-snapshots:** El polling produce snapshots DEBUG sin cartas ni prompts; stages: satisfied
- [x] **tests-pass:** Tests y E2E permanecen verdes; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
