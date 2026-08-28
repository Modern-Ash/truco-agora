---
schema: "agora/work/v1"
id: "forward-team-names"
swarm: "truco-default-names-fix"
title: "Preservar nombres de equipo del Lobby al backend"
state: "verifying"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"payload-forwarded":"createMatch incluye team_names en el body JSON","backend-custom-names":"POST /matches conserva los dos nombres personalizados y mantiene el fallback","no-regression":"Pasan las suites web y Python, build, lint y E2E HTTP"}
satisfied-criteria: ["payload-forwarded","backend-custom-names","no-regression"]
criterion-statuses: {"payload-forwarded":["satisfied"],"backend-custom-names":["satisfied"],"no-regression":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Preservar nombres de equipo del Lobby al backend

## Description

Corrección del cierre incompleto del Swarm 002: api.js descartaba team_names antes de POST /matches.

## Acceptance criteria

- [x] **payload-forwarded:** createMatch incluye team_names en el body JSON; stages: satisfied
- [x] **backend-custom-names:** POST /matches conserva los dos nombres personalizados y mantiene el fallback; stages: satisfied
- [x] **no-regression:** Pasan las suites web y Python, build, lint y E2E HTTP; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
