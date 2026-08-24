---
schema: "agora/approvals/v1"
approval-roles: ["spec-owner"]
---

# Approvals

| Role | Approved by | Note | Timestamp |
| --- | --- | --- | --- |
| spec-owner | project:owner | StepGate+SteppedController implementados (reusa el patrón WebController), endpoint POST /step, guard 422 si no todos son agente, UI de espectador (botón + auto-play con delay) en Lobby/Table. 108 pytest + 37 vitest, E2E completo, verificado también con curl real end-to-end. | 2026-08-24T11:42:48.892445Z |
