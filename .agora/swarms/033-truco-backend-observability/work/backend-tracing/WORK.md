---
schema: "agora/work/v1"
id: "backend-tracing"
swarm: "truco-backend-observability"
title: "Trazabilidad integral del backend"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"configurable-logging":"TRUCO_LOG_LEVEL y TRUCO_LOG_FILE controlan consola y archivo","request-tracing":"Cada request registra inicio, fin, status y duraci\u00f3n con request_id","match-tracing":"Sesi\u00f3n, pasos, decisiones LLM, proveedores y fases del motor dejan eventos con match/jugador/fase","safe-diagnostics":"Los logs y el endpoint diagn\u00f3stico no exponen prompts, credenciales ni cartas ocultas","hang-visibility":"Un bloqueo permite ver pending_step, antig\u00fcedad, hilo y \u00faltimo progreso","tests-pass":"Pruebas, build y E2E permanecen verdes"}
satisfied-criteria: ["configurable-logging","request-tracing","match-tracing","safe-diagnostics","hang-visibility","tests-pass"]
criterion-statuses: {"configurable-logging":["satisfied"],"request-tracing":["satisfied"],"match-tracing":["satisfied"],"safe-diagnostics":["satisfied"],"hang-visibility":["satisfied"],"tests-pass":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Trazabilidad integral del backend

## Description

Agregar logging configurable y seguro para HTTP, sesiones, step gate, controladores LLM, proveedores y motor; exponer diagnóstico de una partida sin cartas ocultas ni prompts.

## Acceptance criteria

- [x] **configurable-logging:** TRUCO_LOG_LEVEL y TRUCO_LOG_FILE controlan consola y archivo; stages: satisfied
- [x] **request-tracing:** Cada request registra inicio, fin, status y duración con request_id; stages: satisfied
- [x] **match-tracing:** Sesión, pasos, decisiones LLM, proveedores y fases del motor dejan eventos con match/jugador/fase; stages: satisfied
- [x] **safe-diagnostics:** Los logs y el endpoint diagnóstico no exponen prompts, credenciales ni cartas ocultas; stages: satisfied
- [x] **hang-visibility:** Un bloqueo permite ver pending_step, antigüedad, hilo y último progreso; stages: satisfied
- [x] **tests-pass:** Pruebas, build y E2E permanecen verdes; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
