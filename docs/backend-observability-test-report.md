# Swarm 033 — informe de verificación

Fecha: 2026-08-27

## Resultado

- `68 passed`: observabilidad, recuperación de sesión, controladores,
  proveedores, motor LLM y referee.
- `114 passed`: suite de dominio completa excluyendo los tres módulos que usan
  `fastapi.testclient.TestClient`, bloqueado en este entorno por la combinación
  Python 3.14.4 / Starlette 1.6.0.
- `82 passed`: tests Vitest del frontend.
- `npm run lint`: exitoso; conserva cuatro warnings preexistentes de Fast
  Refresh, sin errores.
- `npm run build`: exitoso.
- `npm run e2e`: exitoso en puerto local aislado; completó una partida por HTTP
  en 182 jugadas y verificó `X-Request-ID`, diagnóstico vivo, step mode,
  cantos, reparto, señas y cartas tapadas.

La API real con Uvicorn cubre la integración HTTP que los módulos TestClient no
pueden ejecutar bajo este runtime.

## Evidencia de trazabilidad

El archivo rotativo configurado durante E2E contiene eventos de:

- configuración del logger;
- inicio/fin de request y `request_id`;
- creación de partida e hilo;
- mano, fase, ronda, canto, respuesta, carta y puntaje;
- espera/liberación/timeout del siguiente paso;
- controlador LLM, proveedor, catálogo y fallback;
- recuperación, error y finalización.

Una búsqueda de `prompt=`, `credentials=`, `palo=`, `numero=`, API keys y
Authorization no produjo coincidencias. El helper también omite campos
sensibles y redacta secretos embebidos en mensajes de error.

## Diagnóstico de bloqueo

`GET /matches/{match_id}/diagnostics` fue verificado con una sesión activa. La
respuesta incluye hilo, paso pendiente, antigüedad, generación, último progreso
y recuperación, sin manos, cartas ni prompts.

## Ajuste DEBUG por defecto

- `69 passed` en la suite focal después de activar DEBUG y el archivo por
  defecto.
- Se verificó la creación de `logs/truco-backend-debug.log` y la presencia de
  eventos `DEBUG event=state.snapshot`.
- El snapshot de depuración contiene solamente metadatos públicos: partida,
  visor, turno, canto, generación y cantidad de eventos.
- `npm run dev` fue convertido en supervisor de Vite + Uvicorn para que los
  eventos del backend aparezcan en la misma terminal con prefijo `[api]`.
- La vista en vivo usa directamente `stdout/stderr`, sin `tail`. Si el puerto
  8000 ya tiene otro backend, el supervisor se detiene con una explicación para
  evitar una terminal aparentemente activa pero sin acceso a sus logs.
