---
schema: "agora/work/v1"
id: "tailwind-migration"
swarm: "truco-ui-modernization"
title: "Migrar la webapp a Tailwind CSS"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"tailwind-installed":"Tailwind CSS instalado v\u00eda @tailwindcss/vite, configurado y funcionando en build/dev","components-migrated":"Lobby, Table, Hand, Actions, Scoreboard migrados a utility classes de Tailwind","visual-identity":"Paleta y jerarqu\u00eda visual preservan la identidad (pa\u00f1o verde/crema/dorado) con mejoras de spacing, sombras y transiciones","tests-pass":"Todos los tests existentes (vitest + E2E) siguen pasando sin modificar assertions de l\u00f3gica, solo ajustando selectores de clase si es necesario"}
satisfied-criteria: ["tailwind-installed","components-migrated","visual-identity","tests-pass"]
criterion-statuses: {"tailwind-installed":["satisfied"],"components-migrated":["satisfied"],"visual-identity":["satisfied"],"tests-pass":["satisfied"]}
required-artifacts: ["spec.md","test-report"]
child-work-refs: []
budget-limits: null
---

# Migrar la webapp a Tailwind CSS

## Description

Instalar Tailwind CSS (v4, plugin de Vite) y migrar los componentes existentes de CSS plano a utility classes, con una paleta que preserve la identidad visual actual (paño verde, crema, dorado) pero con mejor jerarquía tipográfica, sombras, transiciones y responsive. Sin tocar lógica de negocio ni contrato con la API.

## Acceptance criteria

- [x] **tailwind-installed:** Tailwind CSS instalado vía @tailwindcss/vite, configurado y funcionando en build/dev; stages: satisfied
- [x] **components-migrated:** Lobby, Table, Hand, Actions, Scoreboard migrados a utility classes de Tailwind; stages: satisfied
- [x] **visual-identity:** Paleta y jerarquía visual preservan la identidad (paño verde/crema/dorado) con mejoras de spacing, sombras y transiciones; stages: satisfied
- [x] **tests-pass:** Todos los tests existentes (vitest + E2E) siguen pasando sin modificar assertions de lógica, solo ajustando selectores de clase si es necesario; stages: satisfied

## Required artifacts

- spec.md
- test-report
