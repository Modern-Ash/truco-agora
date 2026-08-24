---
schema: "agora/work/v1"
id: "post-migration-fixes"
swarm: "truco-ui-fixes"
title: "Fixes post-migraci\u00f3n: color tokens Tailwind v4 + claridad de turno"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"color-tokens-fixed":"Tokens de color @theme renombrados a ASCII; utilities con sintaxis !important de v4 (sufijo) generan CSS real","chips-restored":"Badges MANO/TU TURNO/JUGANDO tienen estilo visible","suit-icons":"Palos representados con \u00edconos SVG propios del mazo espa\u00f1ol","turn-clarity":"Banner de turno prominente + mensaje 'Esperando a X'"}
satisfied-criteria: ["color-tokens-fixed","chips-restored","suit-icons","turn-clarity"]
criterion-statuses: {"color-tokens-fixed":["satisfied"],"chips-restored":["satisfied"],"suit-icons":["satisfied"],"turn-clarity":["satisfied"]}
required-artifacts: ["test-report"]
child-work-refs: []
budget-limits: null
---

# Fixes post-migración: color tokens Tailwind v4 + claridad de turno

## Description

Bugs encontrados al probar la migración a Tailwind en vivo: (1) token @theme con ñ rompía la generación de utilities en Tailwind v4; (2) sintaxis !important de v3 en vez de v4; (3) clases .chip/.chip.turno quedaron sin CSS; (4) glyphs de palo con emojis ambiguos; (5) falta de indicador de turno prominente.

## Acceptance criteria

- [x] **color-tokens-fixed:** Tokens de color @theme renombrados a ASCII; utilities con sintaxis !important de v4 (sufijo) generan CSS real; stages: satisfied
- [x] **chips-restored:** Badges MANO/TU TURNO/JUGANDO tienen estilo visible; stages: satisfied
- [x] **suit-icons:** Palos representados con íconos SVG propios del mazo español; stages: satisfied
- [x] **turn-clarity:** Banner de turno prominente + mensaje 'Esperando a X'; stages: satisfied

## Required artifacts

- test-report
