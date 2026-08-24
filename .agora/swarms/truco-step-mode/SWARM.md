---
schema: "agora/swarm/v1"
id: "truco-step-mode"
method: "spec-driven"
status: "completed"
branch: "agora/truco-step-mode"
required-roles: ["spec-owner","developer"]
assignments: {"spec-owner":"project:owner","developer":"project:agent"}
---

# Swarm truco-step-mode

## Objective

Modo espectador paso a paso: cuando todos los jugadores son agentes LLM, permitir que un humano controle el ritmo de la partida (botón 'siguiente movida' + auto-play con delay configurable), recreando la interactividad de una partida humana

## Assignments

| Role | Actor |
| --- | --- |
| spec-owner | project:owner |
| developer | project:agent |
