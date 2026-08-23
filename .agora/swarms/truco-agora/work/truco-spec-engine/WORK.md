---
schema: "agora/work/v1"
id: "truco-spec-engine"
swarm: "truco-agora"
title: "Especificar y construir el motor de Truco Argentino"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"spec-completa":"Spec cubre mazo, ranking truco/envido, flor, cantos, escalado (truco/retruco/vale cuatro), se\u00f1as y condiciones de fin de partida (15/30)","motor-reglas":"Motor implementa reparto, ronda de envido, ronda de truco con 3 bazas, resoluci\u00f3n de parda, irse al mazo","cli-jugable":"CLI permite jugar una partida completa 1v1 entre dos jugadores humanos por turnos","tests-reglas":"Suite de tests automatizados cubre reglas clave (ranking, envido scoring, escalado de truco, fin de partida)"}
satisfied-criteria: ["spec-completa","motor-reglas","cli-jugable","tests-reglas"]
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# Especificar y construir el motor de Truco Argentino

## Description

Definir spec formal del juego (reglas, cantos, envido/flor/truco, escalado, señas, puntaje) y construir un motor + CLI jugable en base al reglamento oficial.

## Acceptance criteria

- [x] **spec-completa:** Spec cubre mazo, ranking truco/envido, flor, cantos, escalado (truco/retruco/vale cuatro), señas y condiciones de fin de partida (15/30)
- [x] **motor-reglas:** Motor implementa reparto, ronda de envido, ronda de truco con 3 bazas, resolución de parda, irse al mazo
- [x] **cli-jugable:** CLI permite jugar una partida completa 1v1 entre dos jugadores humanos por turnos
- [x] **tests-reglas:** Suite de tests automatizados cubre reglas clave (ranking, envido scoring, escalado de truco, fin de partida)

## Required artifacts

- spec.md
- test-report
