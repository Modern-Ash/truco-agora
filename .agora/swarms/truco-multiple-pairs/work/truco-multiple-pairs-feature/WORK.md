---
schema: "agora/work/v1"
id: "truco-multiple-pairs-feature"
swarm: "truco-multiple-pairs"
title: "Implementar soporte para m\u00faltiples parejas (2v2)"
state: "drafting"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"spec-updated":"La especificaci\u00f3n incluye las reglas de 2v2","engine-updated":"El motor soporta equipos y turnos horarios","cli-updated":"La CLI permite modo 2v2","tests-updated":"Existen tests verificando la modalidad 2v2"}
satisfied-criteria: ["spec-updated"]
criterion-statuses: {"spec-updated":["satisfied"],"engine-updated":[],"cli-updated":[],"tests-updated":[]}
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# Implementar soporte para múltiples parejas (2v2)

## Description

Transicionar el motor de un modelo estrictamente 1v1 a uno basado en equipos (parejas). Incluye cambios en la rotación de turnos (sentido horario), puntuación por equipo, y cálculo de envido basado en el mejor puntaje de la pareja.

## Acceptance criteria

- [x] **spec-updated:** La especificación incluye las reglas de 2v2; stages: satisfied
- [ ] **engine-updated:** El motor soporta equipos y turnos horarios; stages: none
- [ ] **cli-updated:** La CLI permite modo 2v2; stages: none
- [ ] **tests-updated:** Existen tests verificando la modalidad 2v2; stages: none

## Required artifacts

- none
