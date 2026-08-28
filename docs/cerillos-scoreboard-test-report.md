# Verificación del marcador de cinco cerillos

Fecha: 2026-08-25

- `npm test`: 4 archivos, 48 pruebas aprobadas.
- Casos específicos: 9 = 5+4 cerillos; 16/30 = 15 malas + 1 buena;
  30/30 = dos franjas completas; número exacto y campeón accesibles.
- `npm run build`: aprobado.
- `npm run lint`: aprobado, con 3 advertencias conocidas de Fast Refresh.
- `npm run e2e`: aprobado; partida HTTP completa y autoplay LLM vs LLM.
- `git diff --check`: aprobado.

El marcador usa SVG nativo y conserva tres espacios por franja. No agrega
assets de red ni modifica el cálculo de puntaje del motor.
