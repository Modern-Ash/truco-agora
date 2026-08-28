# Swarm 033 — trazabilidad integral del backend

## Objetivo

Hacer observable cada transición relevante de una partida para diagnosticar
esperas en `Resolviendo jugada…` sin inspeccionar a ciegas el hilo del motor.

## Cobertura

- HTTP: inicio, fin, estado, duración y `request_id`.
- Sesión: creación, comienzo/fin de mano, recuperación, error y ganador.
- Step mode: publicación, apertura, liberación, generación y timeout.
- Controlador LLM: tipo de decisión, opciones legales, elección y duración.
- Proveedores: binario/modelo, inicio, salida, timeout y fallback.
- Motor: reparto, fase, ronda, canto, respuesta, carta, baza, puntos y mano.
- Catálogo de modelos: proveedor, fuente, duración y cantidad encontrada.

## Seguridad

No se registran prompts, cuerpos HTTP, credenciales ni caras de cartas que
deban permanecer ocultas. Las jugadas se describen por jugador, fase y cantidad
de cartas restantes. Las decisiones registradas siempre pertenecen al conjunto
de opciones legales ya público.

## Configuración

- `TRUCO_LOG_LEVEL`: `DEBUG`, `INFO`, `WARNING`, `ERROR`; default `DEBUG`.
- `TRUCO_LOG_FILE`: por defecto escribe `logs/truco-backend-debug.log`, un
  archivo rotativo de hasta 5 MiB con tres respaldos. Un valor vacío lo
  desactiva explícitamente.

En DEBUG cada lectura de estado agrega `state.snapshot` con turno, canto,
generación y cantidad de eventos, sin serializar manos ni cartas.

`cd webapp && npm run dev` levanta Vite y Uvicorn en el mismo proceso supervisor.
La terminal conecta directamente el `stdout/stderr` de ambos procesos y
distingue las salidas con `[web]` y `[api]`; no usa `tail` para la vista en
vivo. Si ya existe un backend en el puerto configurado, falla explícitamente
porque no puede apropiarse de la salida de otro proceso. Para levantar solamente
una capa siguen disponibles `npm run dev:web` y `npm run dev:api`.

Formato estable:

```text
2026-08-27T21:00:00 INFO truco.api [match-thread-ab12] event=match.hand.start match_id=ab12 hand=4 mano=Ana
```

## Diagnóstico vivo

`GET /matches/{match_id}/diagnostics` devuelve exclusivamente metadatos
operativos: estado del hilo, paso pendiente y antigüedad, última señal de
progreso, generación, recuperación y error. No devuelve manos ni prompts.
