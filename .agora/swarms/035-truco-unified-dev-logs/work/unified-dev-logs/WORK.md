---
schema: "agora/work/v1"
id: "unified-dev-logs"
swarm: "truco-unified-dev-logs"
title: "Logs API en npm run dev"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"unified-command":"npm run dev levanta web y API","visible-api":"La terminal muestra eventos backend con prefijo api","existing-backend":"Un backend existente no cierra Vite y su log se sigue","tests-pass":"Frontend, build y arranque real pasan"}
satisfied-criteria: ["unified-command","visible-api","existing-backend","tests-pass"]
criterion-statuses: {"unified-command":["satisfied"],"visible-api":["satisfied"],"existing-backend":["satisfied"],"tests-pass":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Logs API en npm run dev

## Description

Extensión de la spec existente: supervisar Vite/Uvicorn, mostrar prefijos y seguir el log si el backend ya ocupa el puerto.

## Acceptance criteria

- [x] **unified-command:** npm run dev levanta web y API; stages: satisfied
- [x] **visible-api:** La terminal muestra eventos backend con prefijo api; stages: satisfied
- [x] **existing-backend:** Un backend existente no cierra Vite y su log se sigue; stages: satisfied
- [x] **tests-pass:** Frontend, build y arranque real pasan; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
