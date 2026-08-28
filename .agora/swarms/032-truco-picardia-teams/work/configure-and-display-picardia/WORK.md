---
schema: "agora/work/v1"
id: "configure-and-display-picardia"
swarm: "truco-picardia-teams"
title: "Picard\u00eda configurable por jugador o equipo"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"player-scope":"Cada agente puede conservar un nivel de picard\u00eda individual","team-scope":"En 2v2 se puede elegir un nivel compartido para los agentes de cada equipo","table-badge":"La mesa muestra de forma estable el nivel efectivo de picard\u00eda de cada agente","responsive-accessible":"Los nuevos controles e insignias son claros, accesibles y responsive","tests-pass":"Pruebas de backend y frontend y build quedan en verde"}
satisfied-criteria: ["player-scope","team-scope","table-badge","responsive-accessible","tests-pass"]
criterion-statuses: {"player-scope":["satisfied"],"team-scope":["satisfied"],"table-badge":["satisfied"],"responsive-accessible":["satisfied"],"tests-pass":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Picardía configurable por jugador o equipo

## Description

En 2v2 el Lobby permite elegir si la picardía se configura por asiento o por equipo; la API resuelve y persiste el nivel efectivo por agente; la mesa lo muestra junto a su identidad LLM.

## Acceptance criteria

- [x] **player-scope:** Cada agente puede conservar un nivel de picardía individual; stages: satisfied
- [x] **team-scope:** En 2v2 se puede elegir un nivel compartido para los agentes de cada equipo; stages: satisfied
- [x] **table-badge:** La mesa muestra de forma estable el nivel efectivo de picardía de cada agente; stages: satisfied
- [x] **responsive-accessible:** Los nuevos controles e insignias son claros, accesibles y responsive; stages: satisfied
- [x] **tests-pass:** Pruebas de backend y frontend y build quedan en verde; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
