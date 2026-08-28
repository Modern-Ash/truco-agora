---
schema: "agora/work/v1"
id: "compact-transition-status"
swarm: "truco-compact-transition-status"
title: "Aviso transitorio compacto y centrado"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"compact-transition-status":"El mensaje Preparando siguiente jugada usa ancho intr\u00ednseco, centrado, bajo contraste y no pulsa como un turno","transition-status-verification":"El wrapper conserva altura; tests, lint y build pasan"}
satisfied-criteria: ["compact-transition-status","transition-status-verification"]
criterion-statuses: {"compact-transition-status":["satisfied"],"transition-status-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Aviso transitorio compacto y centrado

## Description

Reemplazar la barra de resolución por una píldora secundaria alineada al game-shell sin perder estabilidad de layout

## Acceptance criteria

- [x] **compact-transition-status:** El mensaje Preparando siguiente jugada usa ancho intrínseco, centrado, bajo contraste y no pulsa como un turno; stages: satisfied
- [x] **transition-status-verification:** El wrapper conserva altura; tests, lint y build pasan; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
