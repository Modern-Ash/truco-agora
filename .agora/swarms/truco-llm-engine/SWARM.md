---
schema: "agora/swarm/v1"
id: "truco-llm-engine"
method: "spec-driven"
status: "completed"
branch: "agora/truco-llm-engine"
required-roles: ["spec-owner","developer"]
assignments: {"spec-owner":"project:owner","developer":"project:agent"}
---

# Swarm truco-llm-engine

## Objective

Reemplazar el motor de reglas determinista por un motor arbitrado por LLM en todos los puntos de entrada (CLI, API, webapp), aceptando el riesgo de arbitraje inconsistente frente al motor Python determinista

## Assignments

| Role | Actor |
| --- | --- |
| spec-owner | project:owner |
| developer | project:agent |
