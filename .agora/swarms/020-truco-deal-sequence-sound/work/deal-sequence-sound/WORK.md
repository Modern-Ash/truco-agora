---
schema: "agora/work/v1"
id: "deal-sequence-sound"
swarm: "truco-deal-sequence-sound"
title: "Mezcla, reparto y sonido de mesa"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"shuffle-deal-visual":"La apertura y cada nueva mano muestran mezcla y reparto con dorsos espa\u00f1oles dentro del pa\u00f1o","optional-table-sound":"La vista LLM ofrece sonido Web Audio opt-in, persistente y con fallback silencioso","deal-sequence-accessibility":"Los mensajes usan estado accesible, no desplazan la mesa y respetan movimiento reducido","deal-sequence-verification":"Tests frontend, lint, build y E2E pasan con evidencia"}
satisfied-criteria: ["shuffle-deal-visual","optional-table-sound","deal-sequence-accessibility","deal-sequence-verification"]
criterion-statuses: {"shuffle-deal-visual":["satisfied"],"optional-table-sound":["satisfied"],"deal-sequence-accessibility":["satisfied"],"deal-sequence-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Mezcla, reparto y sonido de mesa

## Description

Mostrar fases gráficas dentro del paño y ofrecer audio de cartas opt-in sin desestabilizar la partida

## Acceptance criteria

- [x] **shuffle-deal-visual:** La apertura y cada nueva mano muestran mezcla y reparto con dorsos españoles dentro del paño; stages: satisfied
- [x] **optional-table-sound:** La vista LLM ofrece sonido Web Audio opt-in, persistente y con fallback silencioso; stages: satisfied
- [x] **deal-sequence-accessibility:** Los mensajes usan estado accesible, no desplazan la mesa y respetan movimiento reducido; stages: satisfied
- [x] **deal-sequence-verification:** Tests frontend, lint, build y E2E pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
