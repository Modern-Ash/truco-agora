---
schema: "agora/work/v1"
id: "spectator-autoplay"
swarm: "truco-llm-autoplay"
title: "Autoplay configurable para partidas 100% LLM"
state: "verifying"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"spectator-auto":"Una partida 100% LLM activa step_mode y abre directamente la vista de espectador","configurable-delay":"El espectador inicia autoplay con delay seleccionable de al menos 1 segundo y puede pausarlo","manual-next":"El espectador puede liberar exactamente la siguiente decisi\u00f3n con un bot\u00f3n","continuous-autoplay":"El autoplay contin\u00faa aunque dos pasos consecutivos tengan igual jugador y tipo","no-regression":"Pasan suites web y Python, build, lint y E2E"}
satisfied-criteria: ["spectator-auto","configurable-delay","manual-next","continuous-autoplay","no-regression"]
criterion-statuses: {"spectator-auto":["satisfied"],"configurable-delay":["satisfied"],"manual-next":["satisfied"],"continuous-autoplay":["satisfied"],"no-regression":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Autoplay configurable para partidas 100% LLM

## Description

Las partidas con todos los asientos agente entran como espectador, avanzan con delay configurable y conservan un botón de siguiente movida.

## Acceptance criteria

- [x] **spectator-auto:** Una partida 100% LLM activa step_mode y abre directamente la vista de espectador; stages: satisfied
- [x] **configurable-delay:** El espectador inicia autoplay con delay seleccionable de al menos 1 segundo y puede pausarlo; stages: satisfied
- [x] **manual-next:** El espectador puede liberar exactamente la siguiente decisión con un botón; stages: satisfied
- [x] **continuous-autoplay:** El autoplay continúa aunque dos pasos consecutivos tengan igual jugador y tipo; stages: satisfied
- [x] **no-regression:** Pasan suites web y Python, build, lint y E2E; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
