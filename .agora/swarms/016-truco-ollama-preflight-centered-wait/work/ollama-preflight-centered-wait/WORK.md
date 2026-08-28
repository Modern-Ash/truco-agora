---
schema: "agora/work/v1"
id: "ollama-preflight-centered-wait"
swarm: "truco-ollama-preflight-centered-wait"
title: "Ollama verificado y espera centrada"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"ollama-preflight":"Lobby y API verifican servicio y tags; Ollama no permite modelo vac\u00edo, manual o no instalado","ollama-runtime-fallback":"Conexi\u00f3n fallida y HTTP 404 de Ollama degradan a una opci\u00f3n legal sin interrumpir la sesi\u00f3n","centered-wait-pill":"El mensaje con spinner se centra horizontal y verticalmente dentro de la baza con ancho intr\u00ednseco","ollama-verification":"Tests backend y frontend, lint, build y E2E pasan con evidencia"}
satisfied-criteria: ["ollama-preflight","ollama-runtime-fallback","centered-wait-pill","ollama-verification"]
criterion-statuses: {"ollama-preflight":["satisfied"],"ollama-runtime-fallback":["satisfied"],"centered-wait-pill":["satisfied"],"ollama-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Ollama verificado y espera centrada

## Description

Habilitar Ollama sólo con tags instalados, validar la creación, absorber fallos runtime y centrar la píldora en la baza

## Acceptance criteria

- [x] **ollama-preflight:** Lobby y API verifican servicio y tags; Ollama no permite modelo vacío, manual o no instalado; stages: satisfied
- [x] **ollama-runtime-fallback:** Conexión fallida y HTTP 404 de Ollama degradan a una opción legal sin interrumpir la sesión; stages: satisfied
- [x] **centered-wait-pill:** El mensaje con spinner se centra horizontal y verticalmente dentro de la baza con ancho intrínseco; stages: satisfied
- [x] **ollama-verification:** Tests backend y frontend, lint, build y E2E pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
