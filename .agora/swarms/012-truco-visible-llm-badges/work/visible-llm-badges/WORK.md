---
schema: "agora/work/v1"
id: "visible-llm-badges"
swarm: "truco-visible-llm-badges"
title: "Chapas LLM visibles y fallback por partida"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"visible-llm-badges":"Cada puesto agente muestra LLM, proveedor y modelo con contraste y tama\u00f1o legibles","legacy-metadata-fallback":"La configuraci\u00f3n se guarda por match y completa metadata s\u00f3lo cuando coinciden los participantes","llm-badge-verification":"Tests, lint y build pasan y la evidencia queda registrada"}
satisfied-criteria: ["visible-llm-badges","legacy-metadata-fallback","llm-badge-verification"]
criterion-statuses: {"visible-llm-badges":["satisfied"],"legacy-metadata-fallback":["satisfied"],"llm-badge-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Chapas LLM visibles y fallback por partida

## Description

Reforzar la identidad visual de cada agente y completar metadata ausente desde configuración persistida y validada por match

## Acceptance criteria

- [x] **visible-llm-badges:** Cada puesto agente muestra LLM, proveedor y modelo con contraste y tamaño legibles; stages: satisfied
- [x] **legacy-metadata-fallback:** La configuración se guarda por match y completa metadata sólo cuando coinciden los participantes; stages: satisfied
- [x] **llm-badge-verification:** Tests, lint y build pasan y la evidencia queda registrada; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
