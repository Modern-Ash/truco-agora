---
schema: "agora/work/v1"
id: "llm-arbitrated-engine"
swarm: "truco-llm-engine"
title: "Motor de reglas arbitrado por LLM (reemplaza el determinista como default)"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"llm-engine":"LLMEngine implementado: arbitra comparaci\u00f3n de cartas, envido y resoluci\u00f3n de mano v\u00eda LLM, con fallback auditable (logueado) solo ante fallo de parseo","default-everywhere":"CLI, API y webapp usan LLMEngine por default; el motor determinista queda disponible como --engine deterministic","parity-tests":"Tests verifican que LLMEngine con LLM mockeado (respuestas correctas) da los mismos resultados que el motor determinista en casos conocidos","risk-documented":"spec.md documenta el riesgo aceptado y la decisi\u00f3n expl\u00edcita del usuario"}
satisfied-criteria: ["risk-documented","llm-engine","default-everywhere","parity-tests"]
criterion-statuses: {"llm-engine":["satisfied"],"default-everywhere":["satisfied"],"parity-tests":["satisfied"],"risk-documented":["satisfied"]}
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# Motor de reglas arbitrado por LLM (reemplaza el determinista como default)

## Description

Motor LLM que arbitra comparación de cartas, cálculo de envido y resolución de mano/parda vía LLMClient.generate(), con fallback documentado y auditable al cálculo determinista SOLO ante fallos de parseo (no como preferencia de reglas). Se convierte en el default en CLI, API y webapp. Riesgo de arbitraje inconsistente aceptado explícitamente por el usuario tras advertencia.

## Acceptance criteria

- [x] **llm-engine:** LLMEngine implementado: arbitra comparación de cartas, envido y resolución de mano vía LLM, con fallback auditable (logueado) solo ante fallo de parseo; stages: satisfied
- [x] **default-everywhere:** CLI, API y webapp usan LLMEngine por default; el motor determinista queda disponible como --engine deterministic; stages: satisfied
- [x] **parity-tests:** Tests verifican que LLMEngine con LLM mockeado (respuestas correctas) da los mismos resultados que el motor determinista en casos conocidos; stages: satisfied
- [x] **risk-documented:** spec.md documenta el riesgo aceptado y la decisión explícita del usuario; stages: satisfied

## Required artifacts

- spec.md
- test-report
