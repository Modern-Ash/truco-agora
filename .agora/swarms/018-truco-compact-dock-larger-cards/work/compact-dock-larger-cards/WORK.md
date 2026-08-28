---
schema: "agora/work/v1"
id: "compact-dock-larger-cards"
swarm: "truco-compact-dock-larger-cards"
title: "Dock adaptable y cartas ampliadas"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"auto-collapsing-step-dock":"El dock usa ancho intr\u00ednseco en autoplay, resoluci\u00f3n o sin pending y conserva siempre sus controles","single-wait-message":"Preparando y Resolviendo s\u00f3lo aparecen en la p\u00edldora de la baza, nunca duplicados abajo","larger-spanish-cards":"Las cartas crecen moderadamente en mano, espectador y baza con override m\u00f3vil","compact-dock-verification":"Tests frontend, lint, build y E2E pasan con evidencia"}
satisfied-criteria: ["auto-collapsing-step-dock","single-wait-message","larger-spanish-cards","compact-dock-verification"]
criterion-statuses: {"auto-collapsing-step-dock":["satisfied"],"single-wait-message":["satisfied"],"larger-spanish-cards":["satisfied"],"compact-dock-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Dock adaptable y cartas ampliadas

## Description

Colapsar automáticamente el dock en autoplay/transiciones, quitar estados duplicados y aumentar la baraja sin romper móvil

## Acceptance criteria

- [x] **auto-collapsing-step-dock:** El dock usa ancho intrínseco en autoplay, resolución o sin pending y conserva siempre sus controles; stages: satisfied
- [x] **single-wait-message:** Preparando y Resolviendo sólo aparecen en la píldora de la baza, nunca duplicados abajo; stages: satisfied
- [x] **larger-spanish-cards:** Las cartas crecen moderadamente en mano, espectador y baza con override móvil; stages: satisfied
- [x] **compact-dock-verification:** Tests frontend, lint, build y E2E pasan con evidencia; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
