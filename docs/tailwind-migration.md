# Spec: Migración a Tailwind CSS

Work item: `truco-ui-modernization/tailwind-migration`.

## Alcance
Migrar la webapp de CSS plano a Tailwind CSS v4 (`@tailwindcss/vite`), sin
tocar lógica de negocio, contrato con la API, ni ningún `data-testid`.

## Estrategia (para no romper tests)
Los tests seleccionan elementos por `data-testid` y algunos por clase
semántica literal (`toHaveClass("on")`, `querySelector(".mini-carta.tapada")`,
`querySelector(".puntos")`). Se preservaron **todos** esos nombres de clase
semánticos existentes, agregando utility classes de Tailwind al lado en el
mismo `className`, en vez de reemplazarlos. Esto permitió migrar visualmente
sin modificar ni un assertion de los tests existentes.

## Setup
- `@tailwindcss/vite` agregado al plugin de Vite (`vite.config.js`).
- `styles.css`: `@import "tailwindcss";` + bloque `@theme` mapeando la
  paleta existente (`--color-paño`, `--color-crema`, etc.) a tokens de
  Tailwind, así `bg-paño`, `text-crema` etc. son utilities válidas.
- Animaciones custom (`@keyframes jugar/pulso`) se mantienen como CSS
  crudo post-`@theme`, referenciadas vía clases `.animate-jugar`/`.animate-pulso`.

## Componentes migrados
Lobby, Mesa (SeatPicker), Table, Hand, Actions, Scoreboard — todos con
utility classes (spacing, sombras, transiciones, bordes redondeados) sobre
la paleta paño/crema/madera/oro/rojo existente.

## Resultado
- Bundle CSS: 7.28KB → 22.64KB (utilities reales generadas, no framework
  completo — Tailwind v4 solo emite las clases usadas).
- 25/25 tests vitest sin modificar assertions.
- E2E completo (182 jugadas) sin cambios.
- Verificación visual con navegador headless no disponible en este entorno
  (versión de Chromium cacheada no coincide con la que pide el skill
  `browse`); verificación no visual (build, CSS generado, tests, E2E)
  cubre la migración.

## Criterios de aceptación
- `tailwind-installed`, `components-migrated`, `visual-identity`,
  `tests-pass` — ver work item.
