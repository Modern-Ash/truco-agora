---
schema: "agora/work/v1"
id: "truco-multiple-pairs-feature"
swarm: "truco-multiple-pairs"
title: "Implementar soporte para m\u00faltiples parejas (2v2)"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"spec-updated":"La especificaci\u00f3n incluye las reglas de 2v2","engine-updated":"El motor soporta equipos y turnos horarios","cli-updated":"La CLI permite modo 2v2","tests-updated":"Existen tests verificando la modalidad 2v2"}
satisfied-criteria: ["spec-updated","engine-updated","cli-updated","tests-updated"]
criterion-statuses: {"spec-updated":["satisfied"],"engine-updated":["satisfied"],"cli-updated":["satisfied"],"tests-updated":["satisfied"]}
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# Implementar soporte para múltiples parejas (2v2)

## Description

Transicionar el motor de un modelo estrictamente 1v1 a uno basado en equipos (parejas). Incluye cambios en la rotación de turnos (sentido horario), puntuación por equipo, y cálculo de envido basado en el mejor puntaje de la pareja.

## Acceptance criteria

- [x] **spec-updated:** La especificación incluye las reglas de 2v2; stages: satisfied
- [x] **engine-updated:** El motor soporta equipos y turnos horarios; stages: satisfied
- [x] **cli-updated:** La CLI permite modo 2v2; stages: satisfied
- [x] **tests-updated:** Existen tests verificando la modalidad 2v2; stages: satisfied

## Required artifacts

- none
