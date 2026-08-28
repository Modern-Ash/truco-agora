# Design System — Truco Argentino (webapp)

## Product Context
- **What this is:** webapp React multijugador de Truco Argentino (1v1 y 2v2), jugable por
  humanos y agentes LLM.
- **Quién lo usa:** jugadores humanos vía navegador (multi-dispositivo por polling) y
  agentes LLM configurados por asiento.
- **Espacio/industria:** juegos de cartas online / casual gaming.
- **Tipo de proyecto:** webapp (React 19 + Vite + Tailwind CSS v4).

## Dirección estética
- **Dirección:** editorial criolla contemporánea. Paño verde profundo,
  papel envejecido, tinta, latón y filetes finos; debe sentirse como una
  mesa argentina, no como un dashboard web3.
- **Nivel de decoración:** material y moderado. La baraja y el marcador son
  los protagonistas; el brillo se reserva para estados interactivos.
- **Mood:** club de barrio bien cuidado, juego social y legible.
- **Baraja:** española de 40 cartas con orla, doble índice, pintas dibujadas,
  figuras distintas para sota/caballo/rey y dorso propio.

## Tipografía
- **Display/Hero:** Bricolage Grotesque — títulos, banners de canto ("¡Truco!", "Envido").
  Geométrica con carácter, no Inter/Space Grotesk.
- **Body:** Instrument Sans — texto de interfaz, labels, botones.
- **UI/Labels:** mismo que body.
- **Data/Marcador:** JetBrains Mono, `font-variant-numeric: tabular-nums` — puntaje,
  chips de score.
- **Code:** JetBrains Mono (si aplica en dev tools internos).
- **Carga:** Google Fonts
  `family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600`.
- **Escala:** hero 2.2–3.4rem (clamp), h2 1.5rem, body 1.05rem, mono/data 1.2–1.3rem.

## Color
- **Enfoque:** balanceado-expresivo — el color es el lenguaje de estado del juego
  (turno/pendiente/canto), no decoración libre.
- **Base:** `#0b1512` → `#0f2620` (gradiente radial, casi negro verde-teal).
- **Vidrio/superficie:** `rgba(16, 35, 29, 0.55)` + `backdrop-filter: blur(18px)`,
  borde `rgba(120, 220, 190, 0.14)`.
- **Teal (turno activo):** `#2ee6c4`.
- **Violeta (cantos — truco/envido/flor):** `#a855f7`.
- **Oro (puntaje / indicador de mano):** `#e8b84b`.
- **Cara de carta:** `#f7f3ea` sobre `#16211c` (tinta), palos con su color tradicional
  (espadas/bastos en verde-azulado oscuro, oros/copas sin recolorear — se mantiene la
  legibilidad del naipe español, eso es un "safe choice" deliberado).
- **Modo:** single-theme oscuro por diseño — esta es una estética comprometida
  (como una pantalla de arcade), no se invierte a modo claro.

## Spacing
- **Base:** 8px.
- **Densidad:** cómoda.
- **Escala:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).
- **Border radius:** sm 8px (cartas), md 12–14px (chips, botones), lg 20–28px (paneles de
  vidrio), full 999px (pills, banners).

## Layout
- **Enfoque:** híbrido — Lobby y configuración usan grid disciplinado; la Mesa usa
  composición libre/radial (asientos alrededor del panel de vidrio central) en vez de
  filas simples arriba/abajo.
- **Ancho máximo de contenido:** 1180px en vistas no-mesa; la Mesa ocupa el viewport.

## Motion
- **Enfoque:** intencional.
- **Easing:** entrada ease-out, salida ease-in, movimiento ease-in-out.
- **Duración:** micro 50–100ms (hover de carta), corta 150–250ms (transición de botón),
  media 250–400ms (banner de canto entrando), larga 400–700ms (flip de carta).
- Glow pulsante (`@keyframes pulse`) en el indicador de turno y en banners de canto;
  respeta `prefers-reduced-motion: reduce`.

## Decisions Log
| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2026-08-24 | Sistema inicial dark glass/web3 | Primera dirección visual. |
| 2026-08-27 | Editorial criollo, mobile-first y baraja española ilustrada | El HUD se sentía genérico, el lobby descentrado y las cartas poco reconocibles. |
