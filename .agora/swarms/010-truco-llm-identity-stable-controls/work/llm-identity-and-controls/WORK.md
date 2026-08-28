---
schema: "agora/work/v1"
id: "llm-identity-and-controls"
swarm: "truco-llm-identity-stable-controls"
title: "Identidad LLM y controles estables entre jugadas"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"llm-match-identity":"La API y la mesa identifican proveedor/modelo de cada agente y del motor LLM","stable-step-controls":"Siguiente movida y su panel permanecen visibles, con estado deshabilitado cuando no hay paso listo","stable-refresh-verification":"El refresco transitorio conserva dimensiones y nodos; tests, lint, build y E2E pasan"}
satisfied-criteria: ["llm-match-identity","stable-step-controls","stable-refresh-verification"]
criterion-statuses: {"llm-match-identity":["satisfied"],"stable-step-controls":["satisfied"],"stable-refresh-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Identidad LLM y controles estables entre jugadas

## Description

Publicar y mostrar proveedor/modelo de motor y agentes, mantener franja de turno, panel y botón siguiente durante el refresco transitorio

## Acceptance criteria

- [x] **llm-match-identity:** La API y la mesa identifican proveedor/modelo de cada agente y del motor LLM; stages: satisfied
- [x] **stable-step-controls:** Siguiente movida y su panel permanecen visibles, con estado deshabilitado cuando no hay paso listo; stages: satisfied
- [x] **stable-refresh-verification:** El refresco transitorio conserva dimensiones y nodos; tests, lint, build y E2E pasan; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
