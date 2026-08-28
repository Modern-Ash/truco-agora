---
schema: "agora/work/v1"
id: "trick-and-model-picker"
swarm: "truco-trick-model-catalog"
title: "Baza vigente compacta y selector de modelos LLM"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"current-trick-layout":"La baza centrada muestra solo la carta vigente o un lugar pendiente por participante y preserva el historial","provider-model-discovery":"La API descubre modelos locales de Claude, Codex, OpenCode y Ollama sin exponer credenciales","model-picker-fallback":"El Lobby ofrece un selector real, limpia modelos incompatibles y conserva entrada manual con diagn\u00f3stico","amendment-verification":"Tests, lint, build y E2E pasan y quedan documentados"}
satisfied-criteria: ["current-trick-layout","provider-model-discovery","model-picker-fallback","amendment-verification"]
criterion-statuses: {"current-trick-layout":["satisfied"],"provider-model-discovery":["satisfied"],"model-picker-fallback":["satisfied"],"amendment-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Baza vigente compacta y selector de modelos LLM

## Description

Extender la misma spec para representar solo la vuelta actual en la baza y descubrir modelos de cada proveedor con selector y fallback manual

## Acceptance criteria

- [x] **current-trick-layout:** La baza centrada muestra solo la carta vigente o un lugar pendiente por participante y preserva el historial; stages: satisfied
- [x] **provider-model-discovery:** La API descubre modelos locales de Claude, Codex, OpenCode y Ollama sin exponer credenciales; stages: satisfied
- [x] **model-picker-fallback:** El Lobby ofrece un selector real, limpia modelos incompatibles y conserva entrada manual con diagnóstico; stages: satisfied
- [x] **amendment-verification:** Tests, lint, build y E2E pasan y quedan documentados; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
