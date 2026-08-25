---
schema: "agora/work/v1"
id: "web3-visual-refactor"
swarm: "truco-web3-redesign"
title: "Refactor visual: dark glassmorphism / web3 gaming"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"fonts":"Bricolage Grotesque, Instrument Sans y JetBrains Mono cargados y aplicados seg\u00fan su rol (display/body/mono) en las 3 vistas","palette":"Paleta de DESIGN.md aplicada consistentemente; sin colores fuera de los tokens definidos","glass-glow":"Paneles clave (banner de canto, marcador, acciones) usan vidrio esmerilado + glow de estado (teal=turno, violeta=canto, oro=puntaje/mano)","no-regression":"Los 37 tests de webapp (vitest) siguen pasando sin modificar comportamiento funcional","visual-review":"El resultado se compara contra el preview aprobado y el usuario confirma que refleja la direcci\u00f3n"}
satisfied-criteria: ["fonts","palette","glass-glow","no-regression","visual-review"]
criterion-statuses: {"fonts":["satisfied"],"palette":["satisfied"],"glass-glow":["satisfied"],"no-regression":["satisfied"],"visual-review":["satisfied"]}
required-artifacts: ["source-code"]
child-work-refs: []
budget-limits: null
---

# Refactor visual: dark glassmorphism / web3 gaming

## Description

Aplicar el sistema definido en webapp/DESIGN.md a Lobby, selección de asiento y Mesa: fuentes (Bricolage Grotesque / Instrument Sans / JetBrains Mono), paleta (base #0b1512, teal #2ee6c4, violeta #a855f7, oro #e8b84b), paneles de vidrio con backdrop-filter, glow como lenguaje de estado (turno/pendiente/canto). Reemplaza el theme 'mesa de paño' actual (Tailwind v4).

## Acceptance criteria

- [x] **fonts:** Bricolage Grotesque, Instrument Sans y JetBrains Mono cargados y aplicados según su rol (display/body/mono) en las 3 vistas; stages: satisfied
- [x] **palette:** Paleta de DESIGN.md aplicada consistentemente; sin colores fuera de los tokens definidos; stages: satisfied
- [x] **glass-glow:** Paneles clave (banner de canto, marcador, acciones) usan vidrio esmerilado + glow de estado (teal=turno, violeta=canto, oro=puntaje/mano); stages: satisfied
- [x] **no-regression:** Los 37 tests de webapp (vitest) siguen pasando sin modificar comportamiento funcional; stages: satisfied
- [x] **visual-review:** El resultado se compara contra el preview aprobado y el usuario confirma que refleja la dirección; stages: satisfied

## Required artifacts

- source-code
