---
schema: "agora/work/v1"
id: "truco-api-webapp"
swarm: "truco-api"
title: "API REST por turnos del motor de Truco (FastAPI)"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"api-crear-partida":"POST /matches crea partida 1v1 o 2v2 con target configurable y devuelve id + estado inicial","api-estado-visible":"GET /matches/{id}/state devuelve estado visible de un jugador sin exponer cartas rivales","api-acciones":"POST /matches/{id}/actions aplica jugadas validadas por el motor; ilegal = error con motivo","api-flujo-completo":"Partida completa jugable via API hasta fin (15/30) solo con endpoints HTTP","tests-api":"Suite pytest cubre creacion, visibilidad, acciones ilegales y partida completa"}
satisfied-criteria: ["api-crear-partida","api-estado-visible","api-acciones","api-flujo-completo","tests-api"]
criterion-statuses: {"api-crear-partida":["satisfied"],"api-estado-visible":["satisfied"],"api-acciones":["satisfied"],"api-flujo-completo":["satisfied"],"tests-api":["satisfied"]}
required-artifacts: ["api-spec","test-report"]
child-work-refs: []
budget-limits: null
---

# API REST por turnos del motor de Truco (FastAPI)

## Description

Exponer el motor de Truco como API HTTP stateful para una webapp: sesiones de partida creadas por request, estado visible por jugador (nunca cartas rivales), acciones validadas contra las reglas del motor. Stack: FastAPI + uvicorn.

## Acceptance criteria

- [x] **api-crear-partida:** POST /matches crea partida 1v1 o 2v2 con target configurable y devuelve id + estado inicial; stages: satisfied
- [x] **api-estado-visible:** GET /matches/{id}/state devuelve estado visible de un jugador sin exponer cartas rivales; stages: satisfied
- [x] **api-acciones:** POST /matches/{id}/actions aplica jugadas validadas por el motor; ilegal = error con motivo; stages: satisfied
- [x] **api-flujo-completo:** Partida completa jugable via API hasta fin (15/30) solo con endpoints HTTP; stages: satisfied
- [x] **tests-api:** Suite pytest cubre creacion, visibilidad, acciones ilegales y partida completa; stages: satisfied

## Required artifacts

- api-spec
- test-report
