---
schema: "agora/work/v1"
id: "truco-webapp-v1"
swarm: "truco-webapp"
title: "Webapp React multijugador de Truco Argentino (emulaci\u00f3n de mesa real)"
state: "drafting"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"web-lobby":"Lobby permite elegir 1v1 o 2v2, target 15/30, nombre de jugador y crear/pegar match_id para unirse desde otro dispositivo","web-mesa-central":"Vista cenital de la mesa: mazo, carta por baza de cada jugador en el centro, indicador de turno/mano y qui\u00e9n canta","web-reparto":"Las 3 cartas del jugador se muestran en su mano; al jugar una se coloca en la baza central correspondiente","web-cantos":"Botones contextuales de envido/truco/quiero/no_quiero/retruco/vale cuatro/irse al mazo seg\u00fan las opciones legales que devuelve la API","web-marcador":"Marcador estilo pizarra con malas/buenas hasta 15 o 30 y anuncio de ganador del chico","web-multijugador":"Varias pesta\u00f1as/navegadores ven la misma partida sincronizada por polling del estado; cada uno solo ve sus propias cartas","tests-web":"E2E automatizado cubre lobby, jugada de carta, canto y resoluci\u00f3n de una mano completa"}
satisfied-criteria: []
criterion-statuses: {"web-lobby":[],"web-mesa-central":[],"web-reparto":[],"web-cantos":[],"web-marcador":[],"web-multijugador":[],"tests-web":[]}
required-artifacts: ["webapp-spec","test-report"]
child-work-refs: []
budget-limits: null
---

# Webapp React multijugador de Truco Argentino (emulación de mesa real)

## Description

Frontend React+Vite que consume la API REST por turnos (truco-api) y emula la partida física según bureaudejuegos.com/reglas-truco: lobby con elección de modo (1v1/2v2) y jugadores, unión por match_id desde distintos dispositivos, vista cenital de la mesa con bazas en el centro, reparto animado de 3 cartas, cantos de envido/truco con escalada, marcador de malas y buenas, e historial de la mano. Sin reglas nuevas: flor y cartas tapadas fuera de alcance.

## Acceptance criteria

- [ ] **web-lobby:** Lobby permite elegir 1v1 o 2v2, target 15/30, nombre de jugador y crear/pegar match_id para unirse desde otro dispositivo; stages: none
- [ ] **web-mesa-central:** Vista cenital de la mesa: mazo, carta por baza de cada jugador en el centro, indicador de turno/mano y quién canta; stages: none
- [ ] **web-reparto:** Las 3 cartas del jugador se muestran en su mano; al jugar una se coloca en la baza central correspondiente; stages: none
- [ ] **web-cantos:** Botones contextuales de envido/truco/quiero/no_quiero/retruco/vale cuatro/irse al mazo según las opciones legales que devuelve la API; stages: none
- [ ] **web-marcador:** Marcador estilo pizarra con malas/buenas hasta 15 o 30 y anuncio de ganador del chico; stages: none
- [ ] **web-multijugador:** Varias pestañas/navegadores ven la misma partida sincronizada por polling del estado; cada uno solo ve sus propias cartas; stages: none
- [ ] **tests-web:** E2E automatizado cubre lobby, jugada de carta, canto y resolución de una mano completa; stages: none

## Required artifacts

- webapp-spec
- test-report
