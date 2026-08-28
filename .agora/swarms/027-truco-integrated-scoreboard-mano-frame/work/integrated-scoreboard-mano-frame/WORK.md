---
schema: "agora/work/v1"
id: "integrated-scoreboard-mano-frame"
swarm: "truco-integrated-scoreboard-mano-frame"
title: "Marcador interior y marco del jugador mano"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"in-table-scoreboard":"El marcador queda contenido por la mesa en las vistas de espectador y jugador","decorative-deck-removal":"El dorso decorativo superior desaparece sin afectar las cartas reales","mano-player-frame":"El participante mano recibe un marco dorado persistente y distinto del turno","table-scoreboard-verification":"Tests, lint, build y E2E verifican el nuevo layout"}
satisfied-criteria: ["in-table-scoreboard","decorative-deck-removal","mano-player-frame","table-scoreboard-verification"]
criterion-statuses: {"in-table-scoreboard":["satisfied"],"decorative-deck-removal":["satisfied"],"mano-player-frame":["satisfied"],"table-scoreboard-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Marcador interior y marco del jugador mano

## Description

Mover el marcador dentro del paño, retirar el mazo decorativo y enmarcar al participante mano

## Acceptance criteria

- [x] **in-table-scoreboard:** El marcador queda contenido por la mesa en las vistas de espectador y jugador; stages: satisfied
- [x] **decorative-deck-removal:** El dorso decorativo superior desaparece sin afectar las cartas reales; stages: satisfied
- [x] **mano-player-frame:** El participante mano recibe un marco dorado persistente y distinto del turno; stages: satisfied
- [x] **table-scoreboard-verification:** Tests, lint, build y E2E verifican el nuevo layout; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
