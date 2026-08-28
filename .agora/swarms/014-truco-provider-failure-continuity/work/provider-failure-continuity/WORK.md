---
schema: "agora/work/v1"
id: "provider-failure-continuity"
swarm: "truco-provider-failure-continuity"
title: "Continuidad de partida ante fallos LLM"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"provider-failure-continuity":"Una excepci\u00f3n temporal de OpenCode, Ollama u otro proveedor no publica finished sin ganador ni termina la sesi\u00f3n","legal-decision-fallback":"El controlador registra la falla y usa s\u00f3lo la primera opci\u00f3n legal generada por el motor","continuity-verification":"Una partida completa con ambos clientes ca\u00eddos termina con ganador y tests, lint y build pasan"}
satisfied-criteria: ["provider-failure-continuity","legal-decision-fallback","continuity-verification"]
criterion-statuses: {"provider-failure-continuity":["satisfied"],"legal-decision-fallback":["satisfied"],"continuity-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Continuidad de partida ante fallos LLM

## Description

Aislar excepciones de proveedores externos y degradar a decisiones legales sin marcar la sesión como interrumpida

## Acceptance criteria

- [x] **provider-failure-continuity:** Una excepción temporal de OpenCode, Ollama u otro proveedor no publica finished sin ganador ni termina la sesión; stages: satisfied
- [x] **legal-decision-fallback:** El controlador registra la falla y usa sólo la primera opción legal generada por el motor; stages: satisfied
- [x] **continuity-verification:** Una partida completa con ambos clientes caídos termina con ganador y tests, lint y build pasan; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
