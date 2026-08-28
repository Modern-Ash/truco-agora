---
schema: "agora/work/v1"
id: "waiting-spinners"
swarm: "truco-waiting-spinners"
title: "Spinners estables para estados de espera"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"waiting-spinner-states":"Los estados de espera reales muestran un spinner junto a un texto espec\u00edfico sin ocultar Siguiente movida","reduced-motion-spinner":"El indicador reserva dimensiones fijas, es decorativo para lectores de pantalla y no rota con movimiento reducido","spinner-verification":"Tests, lint y build pasan y la evidencia queda registrada"}
satisfied-criteria: ["waiting-spinner-states","reduced-motion-spinner","spinner-verification"]
criterion-statuses: {"waiting-spinner-states":["satisfied"],"reduced-motion-spinner":["satisfied"],"spinner-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Spinners estables para estados de espera

## Description

Unificar la señal visual de apertura, reconexión, preparación y resolución sin layout shift

## Acceptance criteria

- [x] **waiting-spinner-states:** Los estados de espera reales muestran un spinner junto a un texto específico sin ocultar Siguiente movida; stages: satisfied
- [x] **reduced-motion-spinner:** El indicador reserva dimensiones fijas, es decorativo para lectores de pantalla y no rota con movimiento reducido; stages: satisfied
- [x] **spinner-verification:** Tests, lint y build pasan y la evidencia queda registrada; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
