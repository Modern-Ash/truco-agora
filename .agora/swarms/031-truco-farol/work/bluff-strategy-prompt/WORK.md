---
schema: "agora/work/v1"
id: "bluff-strategy-prompt"
swarm: "truco-farol"
title: "Estrategia de faroleo en el prompt del agente LLM"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"prompt-mentions-bluff":"El prompt del LLMController incluye gu\u00eda expl\u00edcita sobre el farol como estrategia v\u00e1lida","engine-untouched":"El motor de reglas no cambia \u2014 el farol ya era legal, solo se comunica al agente","no-regression":"La suite completa de tests del motor sigue en verde"}
satisfied-criteria: ["prompt-mentions-bluff","engine-untouched","no-regression"]
criterion-statuses: {"prompt-mentions-bluff":["satisfied"],"engine-untouched":["satisfied"],"no-regression":["satisfied"]}
required-artifacts: ["source-code"]
child-work-refs: []
budget-limits: null
---

# Estrategia de faroleo en el prompt del agente LLM

## Description

LLMController._prompt() no daba ninguna guía estratégica; el agente jugaba siempre 'a lo seguro' cantando solo con puntaje real. El farol es táctica legítima y a menudo ganadora en el Truco real (investigado: fumm.ar, noticiasargentinas.com). Se agrega una sección ESTRATEGIA al prompt explicando que blofear es válido, sin tocar el motor de reglas (ya lo permitía).

## Acceptance criteria

- [x] **prompt-mentions-bluff:** El prompt del LLMController incluye guía explícita sobre el farol como estrategia válida; stages: satisfied
- [x] **engine-untouched:** El motor de reglas no cambia — el farol ya era legal, solo se comunica al agente; stages: satisfied
- [x] **no-regression:** La suite completa de tests del motor sigue en verde; stages: satisfied

## Required artifacts

- source-code
