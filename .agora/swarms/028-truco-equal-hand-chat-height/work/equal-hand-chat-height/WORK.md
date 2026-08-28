---
schema: "agora/work/v1"
id: "equal-hand-chat-height"
swarm: "truco-equal-hand-chat-height"
title: "Altura compartida de mano y chat"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"equal-hand-chat-height":"Los paneles de cartas y chat tienen exactamente la misma altura","shared-panel-sizing":"Una clase y variable compartidas gobiernan ambas superficies","scroll-within-equal-height":"El historial extenso desplaza dentro del chat sin cambiar su altura","equal-panel-verification":"Tests, lint, build y E2E verifican la geometr\u00eda compartida"}
satisfied-criteria: ["equal-hand-chat-height","shared-panel-sizing","scroll-within-equal-height","equal-panel-verification"]
criterion-statuses: {"equal-hand-chat-height":["satisfied"],"shared-panel-sizing":["satisfied"],"scroll-within-equal-height":["satisfied"],"equal-panel-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Altura compartida de mano y chat

## Description

Usar una única altura responsive para las cartas y el chat adyacente de cada participante

## Acceptance criteria

- [x] **equal-hand-chat-height:** Los paneles de cartas y chat tienen exactamente la misma altura; stages: satisfied
- [x] **shared-panel-sizing:** Una clase y variable compartidas gobiernan ambas superficies; stages: satisfied
- [x] **scroll-within-equal-height:** El historial extenso desplaza dentro del chat sin cambiar su altura; stages: satisfied
- [x] **equal-panel-verification:** Tests, lint, build y E2E verifican la geometría compartida; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
