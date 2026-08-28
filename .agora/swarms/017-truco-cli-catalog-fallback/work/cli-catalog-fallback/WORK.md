---
schema: "agora/work/v1"
id: "cli-catalog-fallback"
swarm: "truco-cli-catalog-fallback"
title: "Fallback de cat\u00e1logo para proveedores CLI"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"cli-provider-selection":"Codex, Claude y OpenCode siguen habilitados ante cat\u00e1logo 404 o inaccesible","catalog-fallback-labels":"Los proveedores CLI no muestran no disponible y conservan modelos conocidos o entrada manual","cli-catalog-verification":"Tests frontend, lint y build pasan con evidencia"}
satisfied-criteria: ["cli-provider-selection","catalog-fallback-labels","cli-catalog-verification"]
criterion-statuses: {"cli-provider-selection":["satisfied"],"catalog-fallback-labels":["satisfied"],"cli-catalog-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Fallback de catálogo para proveedores CLI

## Description

Separar el diagnóstico del catálogo de la selección de proveedores CLI y conservar el preflight estricto sólo para Ollama

## Acceptance criteria

- [x] **cli-provider-selection:** Codex, Claude y OpenCode siguen habilitados ante catálogo 404 o inaccesible; stages: satisfied
- [x] **catalog-fallback-labels:** Los proveedores CLI no muestran no disponible y conservan modelos conocidos o entrada manual; stages: satisfied
- [x] **cli-catalog-verification:** Tests frontend, lint y build pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
