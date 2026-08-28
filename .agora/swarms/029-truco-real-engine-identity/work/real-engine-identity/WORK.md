---
schema: "agora/work/v1"
id: "real-engine-identity"
swarm: "truco-real-engine-identity"
title: "Identidad real del motor de reglas"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"match-scoped-engine-identity":"La cabecera usa engine_config o configuraci\u00f3n ligada al matchId","no-global-config-injection":"La \u00faltima configuraci\u00f3n global nunca contamina otra partida","honest-optional-model":"El modelo se muestra s\u00f3lo cuando la metadata lo declara","engine-identity-verification":"Tests, lint, build y E2E verifican la identidad din\u00e1mica"}
satisfied-criteria: ["match-scoped-engine-identity","no-global-config-injection","honest-optional-model","engine-identity-verification"]
criterion-statuses: {"match-scoped-engine-identity":["satisfied"],"no-global-config-injection":["satisfied"],"honest-optional-model":["satisfied"],"engine-identity-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Identidad real del motor de reglas

## Description

Eliminar la inyección desde lastConfig y renderizar sólo proveedor/modelo verificables del match

## Acceptance criteria

- [x] **match-scoped-engine-identity:** La cabecera usa engine_config o configuración ligada al matchId; stages: satisfied
- [x] **no-global-config-injection:** La última configuración global nunca contamina otra partida; stages: satisfied
- [x] **honest-optional-model:** El modelo se muestra sólo cuando la metadata lo declara; stages: satisfied
- [x] **engine-identity-verification:** Tests, lint, build y E2E verifican la identidad dinámica; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
