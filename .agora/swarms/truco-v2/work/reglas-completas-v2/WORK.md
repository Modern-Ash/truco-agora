---
schema: "agora/work/v1"
id: "reglas-completas-v2"
swarm: "truco-v2"
title: "Reglas completas v2: flor, envido oficial, tapadas y se\u00f1as"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"flor-motor":"Deteccion de flor (3 mismo palo), cantos flor/contraflor/contraflor-al-resto/con-flor-quiero/me-achico con puntos de bureaudejuegos; la flor anula el envido y se resuelve antes del truco","envido-oficial":"Cadenas acumulativas segun tabla (E+E=4, E+R=5, E+E+R=7...), no quiero paga lo aceptado o 1 si nada, falta envido gana el chico en malas y faltante del lider en buenas, cualquier jugador puede cantar","tapadas":"Jugar carta boca abajo: pierde contra todas, empata solo con otra tapada, su cara no se revela a rivales por estado ni API","senas":"Canal efimero de senas companero-a-companero (mismo equipo) via API con entrega unica; UI en webapp 2v2","web-v2":"Webapp expone botones de flor y jugar tapada cuando son legales, muestra senas recibidas y dorso en tapadas ajenas","tests-v2":"Suites actualizan cobertura de flor, envido oficial, tapadas y senas; E2E sigue verde"}
satisfied-criteria: ["flor-motor","envido-oficial","tapadas","senas","web-v2","tests-v2"]
criterion-statuses: {"flor-motor":["satisfied"],"envido-oficial":["satisfied"],"tapadas":["satisfied"],"senas":["satisfied"],"web-v2":["satisfied"],"tests-v2":["satisfied"]}
required-artifacts: ["reglas-spec","test-report"]
child-work-refs: []
budget-limits: null
---

# Reglas completas v2: flor, envido oficial, tapadas y señas

## Description

Cerrar los gaps documentados desde la primera iteración (spec.md) y la fuente bureaudejuegos.com/reglas-truco: flor y sus envites, envido con acumulación oficial, juego de cartas boca abajo y señas entre compañeros en la webapp.

## Acceptance criteria

- [x] **flor-motor:** Deteccion de flor (3 mismo palo), cantos flor/contraflor/contraflor-al-resto/con-flor-quiero/me-achico con puntos de bureaudejuegos; la flor anula el envido y se resuelve antes del truco; stages: satisfied
- [x] **envido-oficial:** Cadenas acumulativas segun tabla (E+E=4, E+R=5, E+E+R=7...), no quiero paga lo aceptado o 1 si nada, falta envido gana el chico en malas y faltante del lider en buenas, cualquier jugador puede cantar; stages: satisfied
- [x] **tapadas:** Jugar carta boca abajo: pierde contra todas, empata solo con otra tapada, su cara no se revela a rivales por estado ni API; stages: satisfied
- [x] **senas:** Canal efimero de senas companero-a-companero (mismo equipo) via API con entrega unica; UI en webapp 2v2; stages: satisfied
- [x] **web-v2:** Webapp expone botones de flor y jugar tapada cuando son legales, muestra senas recibidas y dorso en tapadas ajenas; stages: satisfied
- [x] **tests-v2:** Suites actualizan cobertura de flor, envido oficial, tapadas y senas; E2E sigue verde; stages: satisfied

## Required artifacts

- reglas-spec
- test-report
