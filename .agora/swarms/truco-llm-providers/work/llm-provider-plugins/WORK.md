---
schema: "agora/work/v1"
id: "llm-provider-plugins"
swarm: "truco-llm-providers"
title: "Proveedores LLM pluggables para jugadores y engine/referee"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"adapters":"Adaptadores LLMClient implementados y testeados para Claude, Codex, OpenCode y Ollama, todos cumpliendo la interfaz decide(prompt, options)->str","config-pluggable":"Selecci\u00f3n de proveedor configurable (CLI/env) para LLMController de jugadores, sin cambiar el motor","referee-role":"Rol 'referee' opcional implementado: LLM narra/reporta la partida v\u00eda el mismo mecanismo pluggable, sin poder alterar el resultado determinista del motor","tests":"Suite de tests cubre selecci\u00f3n de proveedor, fallback ante proveedor no disponible, y aislamiento (LLM nunca decide reglas, solo jugadas/narraci\u00f3n)"}
satisfied-criteria: ["adapters","config-pluggable","referee-role","tests"]
criterion-statuses: {"adapters":["satisfied"],"config-pluggable":["satisfied"],"referee-role":["satisfied"],"tests":["satisfied"]}
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# Proveedores LLM pluggables para jugadores y engine/referee

## Description

Abstraer el backend LLM detrás de una interfaz común (LLMClient) con adaptadores concretos para Claude, Codex, OpenCode y Ollama, seleccionables por configuración. Extender el mismo mecanismo a un nuevo rol opcional 'referee' que arbitra/narra la partida vía LLM sin reemplazar la validación determinista del motor.

## Acceptance criteria

- [x] **adapters:** Adaptadores LLMClient implementados y testeados para Claude, Codex, OpenCode y Ollama, todos cumpliendo la interfaz decide(prompt, options)->str; stages: satisfied
- [x] **config-pluggable:** Selección de proveedor configurable (CLI/env) para LLMController de jugadores, sin cambiar el motor; stages: satisfied
- [x] **referee-role:** Rol 'referee' opcional implementado: LLM narra/reporta la partida vía el mismo mecanismo pluggable, sin poder alterar el resultado determinista del motor; stages: satisfied
- [x] **tests:** Suite de tests cubre selección de proveedor, fallback ante proveedor no disponible, y aislamiento (LLM nunca decide reglas, solo jugadas/narración); stages: satisfied

## Required artifacts

- spec.md
- test-report
