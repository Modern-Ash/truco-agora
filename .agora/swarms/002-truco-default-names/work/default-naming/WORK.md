---
schema: "agora/work/v1"
id: "default-naming"
swarm: "truco-default-names"
title: "Nombres por defecto: equipos (colectividad) y jugadores (humano/robot)"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"team-names":"Cada partida nueva env\u00eda 2 nombres de equipo distintos de un pool de colectividad (club/ciudad/provincia); el backend los usa si vienen, y sigue funcionando sin ellos (retrocompatible)","human-names":"Cada asiento 'web' arranca con un nombre humano aleatorio distinto de los dem\u00e1s asientos","agent-names":"Cada asiento 'agent' arranca con un nombre que denota robot/IA, distinto de los dem\u00e1s asientos","rename-on-toggle":"Cambiar el tipo de un asiento regenera su nombre por defecto acorde al nuevo tipo, salvo que el nombre haya sido editado a mano","no-regression":"Los tests existentes de webapp y del motor Python siguen pasando"}
satisfied-criteria: ["team-names","human-names","agent-names","rename-on-toggle","no-regression"]
criterion-statuses: {"team-names":["satisfied"],"human-names":["satisfied"],"agent-names":["satisfied"],"rename-on-toggle":["satisfied"],"no-regression":["satisfied"]}
required-artifacts: ["source-code"]
child-work-refs: []
budget-limits: null
---

# Nombres por defecto: equipos (colectividad) y jugadores (humano/robot)

## Description

Lobby genera por defecto: 2 nombres de equipo con sabor de colectividad (clubes/ciudades/provincias argentinas), nombres de jugador humanos al azar para asientos 'web', y nombres con onda robot/IA para asientos 'agent'. Se regeneran al cambiar el tipo de asiento (salvo edición manual). Los nombres de equipo se envían al backend (nuevo campo opcional team_names en CreateMatchRequest) y se ven en el Scoreboard sin más cambios.

## Acceptance criteria

- [x] **team-names:** Cada partida nueva envía 2 nombres de equipo distintos de un pool de colectividad (club/ciudad/provincia); el backend los usa si vienen, y sigue funcionando sin ellos (retrocompatible); stages: satisfied
- [x] **human-names:** Cada asiento 'web' arranca con un nombre humano aleatorio distinto de los demás asientos; stages: satisfied
- [x] **agent-names:** Cada asiento 'agent' arranca con un nombre que denota robot/IA, distinto de los demás asientos; stages: satisfied
- [x] **rename-on-toggle:** Cambiar el tipo de un asiento regenera su nombre por defecto acorde al nuevo tipo, salvo que el nombre haya sido editado a mano; stages: satisfied
- [x] **no-regression:** Los tests existentes de webapp y del motor Python siguen pasando; stages: satisfied

## Required artifacts

- source-code
