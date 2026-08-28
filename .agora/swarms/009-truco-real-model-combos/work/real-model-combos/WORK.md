---
schema: "agora/work/v1"
id: "real-model-combos"
swarm: "truco-real-model-combos"
title: "Combos de proveedores y modelos LLM reales"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"real-provider-options":"Los combos del motor y los asientos ofrecen solo Codex, Claude, OpenCode y Ollama, con Codex por defecto","immediate-model-options":"El combo de modelos permanece visible y ofrece opciones detectadas o conocidas, con entrada manual cuando no hay cat\u00e1logo","provider-combo-verification":"Tests, lint y build pasan y la evidencia queda registrada"}
satisfied-criteria: ["real-provider-options","immediate-model-options","provider-combo-verification"]
criterion-statuses: {"real-provider-options":["satisfied"],"immediate-model-options":["satisfied"],"provider-combo-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Combos de proveedores y modelos LLM reales

## Description

Quitar mock de los selectores del Lobby, usar Codex como default y mantener opciones de modelos visibles con catálogo dinámico y respaldo

## Acceptance criteria

- [x] **real-provider-options:** Los combos del motor y los asientos ofrecen solo Codex, Claude, OpenCode y Ollama, con Codex por defecto; stages: satisfied
- [x] **immediate-model-options:** El combo de modelos permanece visible y ofrece opciones detectadas o conocidas, con entrada manual cuando no hay catálogo; stages: satisfied
- [x] **provider-combo-verification:** Tests, lint y build pasan y la evidencia queda registrada; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
