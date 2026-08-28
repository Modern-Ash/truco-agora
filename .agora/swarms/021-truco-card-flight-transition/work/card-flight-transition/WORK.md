---
schema: "agora/work/v1"
id: "card-flight-transition"
swarm: "truco-card-flight-transition"
title: "Transici\u00f3n realista de carta a la baza"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"spatial-card-flight":"Cada carta viaja desde la mano del agente hasta su casillero medido en la baza","single-card-landing":"La carta de destino permanece oculta durante el vuelo y se asienta sin duplicados","card-flight-accessibility":"El vuelo se anuncia a lectores, respeta movimiento reducido y soporta cartas tapadas","card-flight-verification":"Tests frontend, lint, build y E2E pasan con evidencia"}
satisfied-criteria: ["spatial-card-flight","single-card-landing","card-flight-accessibility","card-flight-verification"]
criterion-statuses: {"spatial-card-flight":["satisfied"],"single-card-landing":["satisfied"],"card-flight-accessibility":["satisfied"],"card-flight-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Transición realista de carta a la baza

## Description

Calcular origen y destino para volar la carta sin duplicados, con aterrizaje sonoro y movimiento reducible

## Acceptance criteria

- [x] **spatial-card-flight:** Cada carta viaja desde la mano del agente hasta su casillero medido en la baza; stages: satisfied
- [x] **single-card-landing:** La carta de destino permanece oculta durante el vuelo y se asienta sin duplicados; stages: satisfied
- [x] **card-flight-accessibility:** El vuelo se anuncia a lectores, respeta movimiento reducido y soporta cartas tapadas; stages: satisfied
- [x] **card-flight-verification:** Tests frontend, lint, build y E2E pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
