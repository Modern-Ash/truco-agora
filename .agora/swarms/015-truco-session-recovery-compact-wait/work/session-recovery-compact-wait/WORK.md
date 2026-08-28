---
schema: "agora/work/v1"
id: "session-recovery-compact-wait"
swarm: "truco-session-recovery-compact-wait"
title: "Recuperaci\u00f3n de sesi\u00f3n y espera dentro del pa\u00f1o"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"session-hand-recovery":"La sesi\u00f3n reintenta hasta tres fallos consecutivos conservando marcador y publica recovering sin finished","in-table-wait-status":"Preparaci\u00f3n, resoluci\u00f3n y recuperaci\u00f3n aparecen en una p\u00edldora dentro de Baza en juego sin franja exterior ni spinner duplicado","recovery-layout-verification":"Tests backend y frontend, lint, build y E2E pasan con evidencia registrada"}
satisfied-criteria: ["session-hand-recovery","in-table-wait-status","recovery-layout-verification"]
criterion-statuses: {"session-hand-recovery":["satisfied"],"in-table-wait-status":["satisfied"],"recovery-layout-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Recuperación de sesión y espera dentro del paño

## Description

Reintentar manos fallidas sin publicar un falso final y reemplazar la franja superior por un spinner en la cabecera de la baza

## Acceptance criteria

- [x] **session-hand-recovery:** La sesión reintenta hasta tres fallos consecutivos conservando marcador y publica recovering sin finished; stages: satisfied
- [x] **in-table-wait-status:** Preparación, resolución y recuperación aparecen en una píldora dentro de Baza en juego sin franja exterior ni spinner duplicado; stages: satisfied
- [x] **recovery-layout-verification:** Tests backend y frontend, lint, build y E2E pasan con evidencia registrada; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
