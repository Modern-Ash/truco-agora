---
schema: "agora/work/v1"
id: "engine-and-config-ui"
swarm: "truco-config-ui"
title: "UI de configuraci\u00f3n: motor de reglas y proveedores por asiento"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"engine-selector":"UI permite elegir motor determinista o LLM, y si es LLM, proveedor y modelo, antes de crear la partida","seat-selector":"UI permite elegir por asiento humano o agente LLM, y si es agente, proveedor y modelo","api-wiring":"Lobby.jsx env\u00eda los campos correctos a createMatch (engine, engine_provider, engine_model, players[].kind/provider/model)","tests":"Tests cubren la nueva UI de configuraci\u00f3n (selecci\u00f3n de motor, selecci\u00f3n de asiento humano/agente)"}
satisfied-criteria: ["engine-selector","seat-selector","api-wiring","tests"]
criterion-statuses: {"engine-selector":["satisfied"],"seat-selector":["satisfied"],"api-wiring":["satisfied"],"tests":["satisfied"]}
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# UI de configuración: motor de reglas y proveedores por asiento

## Description

Extender el Lobby para elegir, antes de crear la partida: motor de reglas (llm/deterministic) y su proveedor/modelo si es llm; y por cada asiento, humano o agente LLM con su proveedor/modelo (reusando los campos ya expuestos por la API: engine, engine_provider, engine_model, PlayerSpec.kind/provider/model).

## Acceptance criteria

- [x] **engine-selector:** UI permite elegir motor determinista o LLM, y si es LLM, proveedor y modelo, antes de crear la partida; stages: satisfied
- [x] **seat-selector:** UI permite elegir por asiento humano o agente LLM, y si es agente, proveedor y modelo; stages: satisfied
- [x] **api-wiring:** Lobby.jsx envía los campos correctos a createMatch (engine, engine_provider, engine_model, players[].kind/provider/model); stages: satisfied
- [x] **tests:** Tests cubren la nueva UI de configuración (selección de motor, selección de asiento humano/agente); stages: satisfied

## Required artifacts

- spec.md
- test-report
