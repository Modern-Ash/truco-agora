---
schema: "agora/work/v1"
id: "stable-engine-identity"
swarm: "truco-stable-engine-identity"
title: "Identidad fija del motor LLM"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"persistent-engine-identity":"La etiqueta Motor LLM conserva proveedor y modelo cuando un snapshot transitorio omite engine_config","engine-identity-verification":"Tests frontend, lint, build y E2E pasan con evidencia"}
satisfied-criteria: ["persistent-engine-identity","engine-identity-verification"]
criterion-statuses: {"persistent-engine-identity":["satisfied"],"engine-identity-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Identidad fija del motor LLM

## Description

Conservar el último engine_config válido para evitar que la etiqueta del motor aparezca y desaparezca entre snapshots

## Acceptance criteria

- [x] **persistent-engine-identity:** La etiqueta Motor LLM conserva proveedor y modelo cuando un snapshot transitorio omite engine_config; stages: satisfied
- [x] **engine-identity-verification:** Tests frontend, lint, build y E2E pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
