---
schema: "agora/work/v1"
id: "spectator-step-mode"
swarm: "truco-step-mode"
title: "Modo espectador paso a paso para partidas 100% LLM"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"step-gate":"StepGate + SteppedController implementados: bloquean cada decisi\u00f3n de un agente hasta liberaci\u00f3n expl\u00edcita, reusando el patr\u00f3n de threading.Event ya probado en WebController","step-endpoint":"POST /matches/{id}/step libera la siguiente decisi\u00f3n pendiente y devuelve el snapshot actualizado; snapshot expone pending_step (qui\u00e9n y qu\u00e9 tipo de decisi\u00f3n)","scope-guard":"step_mode solo se acepta si todos los jugadores son kind=agent (422 en caso contrario); partidas normales (con humano) no cambian de comportamiento","spectator-ui":"Lobby permite activar 'paso a paso' cuando todos los asientos son agente; Table muestra bot\u00f3n 'Siguiente movida' + auto-play con delay configurable cuando hay un pending_step"}
satisfied-criteria: ["step-gate","step-endpoint","scope-guard","spectator-ui"]
criterion-statuses: {"step-gate":["satisfied"],"step-endpoint":["satisfied"],"scope-guard":["satisfied"],"spectator-ui":["satisfied"]}
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# Modo espectador paso a paso para partidas 100% LLM

## Description

Cuando todos los jugadores de una partida son agentes LLM (kind=agent), permitir opt-in a 'step_mode': el motor bloquea antes de cada decisión de un agente hasta que un espectador humano pida explícitamente la siguiente movida (POST /matches/{id}/step), con un botón manual y auto-play con delay configurable en la webapp. No cambia el motor de reglas ni el comportamiento de partidas con al menos un jugador humano.

## Acceptance criteria

- [x] **step-gate:** StepGate + SteppedController implementados: bloquean cada decisión de un agente hasta liberación explícita, reusando el patrón de threading.Event ya probado en WebController; stages: satisfied
- [x] **step-endpoint:** POST /matches/{id}/step libera la siguiente decisión pendiente y devuelve el snapshot actualizado; snapshot expone pending_step (quién y qué tipo de decisión); stages: satisfied
- [x] **scope-guard:** step_mode solo se acepta si todos los jugadores son kind=agent (422 en caso contrario); partidas normales (con humano) no cambian de comportamiento; stages: satisfied
- [x] **spectator-ui:** Lobby permite activar 'paso a paso' cuando todos los asientos son agente; Table muestra botón 'Siguiente movida' + auto-play con delay configurable cuando hay un pending_step; stages: satisfied

## Required artifacts

- spec.md
- test-report
