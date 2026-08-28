# Test report: reglas verificadas y experiencia mobile-first

Fecha: 2026-08-27  
Work Agora: `truco-rules-mobile-cards/rules-and-mobile-table`

## Resultado

| Verificación | Resultado |
| --- | --- |
| Motor y reglas (`pytest`, suites sin transporte ASGI) | **95 passed** |
| Componentes y flujos React (`vitest`) | **60 passed** |
| Lint (`oxlint`) | **0 errores**, 3 warnings preexistentes de Fast Refresh |
| Build de producción (`vite build`) | **OK**, 31 módulos transformados |
| Flujo por HTTP real (`npm run e2e`) | **OK** |
| `git diff --check` | **OK** |

## Cobertura relevante

- Jerarquía completa de las 40 cartas, incluida la frontera
  `12/11/10 > 7 de basto/copa`.
- Ganador de baza y mano por equipo, pardas cruzadas y dos bazas ganadas por
  compañeros en 2v2.
- Envido, Real Envido o Falta Envido como aperturas; cadena única y escalado
  acumulativo.
- Truco → Retruco → Vale Cuatro sin saltos y con derecho de elevación alternado.
- Variante sin flor por defecto y con flor opt-in en motor, API y Lobby.
- Persistencia de la variante y proveedores al pedir revancha.
- Baraja española compartida en mano, espectadores, baza y cartas tapadas.
- Creación 1v1, aislamiento de manos, señas 2v2, autoplay LLM y partida
  completa a 15 puntos a través de Uvicorn.

## Nota del entorno

`fastapi.testclient.TestClient` se bloquea en este entorno con Python 3.14,
Starlette 1.6 y AnyIO 4.14 incluso al pedir `/openapi.json`; no alcanza a
ejecutar ningún endpoint. La API se verificó contra un servidor Uvicorn real:
el E2E completó 182 jugadas y terminó 15–12. Este incidente pertenece al
arnés ASGI sincrónico del entorno, no al ciclo de petición HTTP de la app.

La herramienta de navegador integrada no tenía una instancia disponible en
la sesión. El layout responsive se verificó por estructura mobile-first,
breakpoints, controles de 44 px, tests de DOM y build; queda recomendado un
smoke visual adicional en dispositivos reales antes de publicar.

## Enmienda: pantalla de juego centrada

La captura posterior reveló que la pantalla de juego conservaba un
`max-width` de 1152 px aislado de la cabecera. La enmienda agrega un shell
compartido de 1440 px para marcador, mazo, paño y controles; explicita el
ancho de `html/body/#root`, y reduce el gutter a 8 px en móvil.

- Vitest: **53 passed**, incluidas dos pruebas estructurales nuevas del shell.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 30 módulos transformados.
- E2E real: **OK**, 182 jugadas y resultado 15–12.
- `git diff --check`: **OK**.

## Segunda enmienda: baza vigente y selector de modelos

La baza central ahora muestra sólo la vuelta vigente: la última carta de cada
participante que ya actuó y un único lugar pendiente para quien falta. Usa un
máximo de 46 rem, identifica el número de vuelta y libera el historial
acumulado al dock existente.

El Lobby consulta `GET /llm/models`, ofrece un selector real cuando encuentra
modelos y mantiene “Otro modelo…” o entrada manual si el proveedor no puede
enumerarlos. El endpoint usa el catálogo local de Codex, los modelos
configurados de OpenCode, los tags de Ollama y aliases para Claude Code; no
lee credenciales.

- Pytest: **95 passed**, incluidas 6 pruebas de descubrimiento por proveedor.
- Vitest: **56 passed**, incluidas regresiones de baza vigente y selector.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 31 módulos transformados.

- E2E real: **OK**, endpoint de modelos y partida de 182 jugadas, 15–12.

## Tercera enmienda: combos de modelos reales

Los combos del motor y de cada asiento ya no incluyen `mock`. Codex queda
como proveedor inicial y el selector de modelo permanece visible desde el
primer render con opciones conocidas; el catálogo dinámico de la API las
reemplaza cuando responde. Claude usa el mismo patrón y los proveedores sin
catálogo presentan explícitamente la opción manual.

- Vitest: **57 passed**, incluida la regresión que comprueba modelos Codex
  iniciales y ausencia de `mock` en ambos combos.
- Pytest: **95 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 31 módulos transformados.
- E2E real: **OK**, catálogo HTTP y partida completa de 182 jugadas, 15–12.

## Cuarta enmienda: identidad LLM y estabilidad entre pasos

El snapshot publica ahora `engine_config`, `step_mode` y la configuración
`agent` de cada jugador. La mesa muestra proveedor/modelo bajo cada agente y
la identidad del motor LLM en la cabecera. En step-mode, franja de turno,
panel y botón permanecen montados durante el intervalo transitorio sin
`pending_step`; sólo cambia el mensaje y el botón queda temporalmente
deshabilitado.

- Vitest: **59 passed**, incluidas regresiones de identidad en espectador y
  mesa mixta, y conservación de los mismos nodos durante el refresco.
- Pytest: **95 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 31 módulos transformados.
- E2E real: **OK**, metadata de ambos agentes, step-mode y partida completa
  de 182 jugadas verificados por HTTP.

## Quinta enmienda: aviso transitorio compacto

`Resolviendo la próxima movida…` dejó de ocupar una barra desacoplada de la
mesa. El estado ahora dice `Preparando siguiente jugada…` dentro de una
píldora de ancho intrínseco, centrada por un wrapper `game-shell`, sin pulso
amarillo ni sombra. El wrapper conserva la altura estable definida en la
enmienda anterior.

- Vitest de mesa: **35 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 31 módulos transformados.

## Sexta enmienda: identidad LLM visible en el paño

Cada puesto agente muestra ahora una chapa de mayor contraste con el texto
`LLM · Proveedor · Modelo`. El Lobby persiste la configuración por `match_id`
y `Mesa` la usa sólo cuando el snapshot no trae metadata y los participantes
coinciden, cubriendo partidas abiertas con una API anterior.

- Vitest: **60 passed**, incluida la recuperación de proveedor/modelo desde
  configuración guardada y su render dentro del paño.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes.
- Build: **OK**, 31 módulos transformados.

## Séptima enmienda: indicadores de espera

La apertura y reconexión de la mesa, la preparación del próximo paso y la
resolución de una jugada comparten ahora un spinner compacto. El estado de
resolución tiene prioridad sobre el snapshot anterior, mientras el botón
`Siguiente movida` permanece visible y deshabilitado. El indicador reserva su
espacio y detiene la animación con `prefers-reduced-motion`.

- Vitest: **63 passed**, incluidas regresiones para apertura, reconexión,
  preparación transitoria y una promesa de jugada todavía sin resolver.
- Vitest de mesa: **39 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.

## Octava enmienda: continuidad ante fallos de proveedor

La excepción de un jugador OpenCode/Ollama ya no escapa hasta el hilo de la
sesión ni convierte una mano activa en `Partida interrumpida`. El controlador
registra el incidente y usa la primera decisión del conjunto legal generado
por el motor. Una regresión juega una partida completa con ambos clientes
fallando en todas sus decisiones y exige un ganador a 15 puntos.

- Pytest de motor, controladores, proveedores y reglas: **93 passed**.
- Regresión específica del controlador: **7 passed**.
- Vitest: **63 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.

## Novena enmienda: recuperación y espera compacta dentro del paño

La sesión ya no se da por terminada ante la primera excepción fuera del
controlador: reintenta la mano hasta tres veces y sólo publica un error fatal
si los fallos son consecutivos. Durante preparación, resolución o recuperación
el spinner aparece dentro de la cabecera de `Baza en juego`; la franja superior
del espectador fue eliminada y el panel inferior no duplica el indicador.

- Regresión de recuperación de sesión: **1 passed**.
- Pytest de motor, controladores, proveedores y reglas: **93 passed**.
- Vitest: **64 passed**; suite de mesa: **40 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.

## Décima enmienda: Ollama verificado y spinner centrado

Los combos precargan la disponibilidad de cada proveedor y deshabilitan
Ollama si el servicio no responde o no tiene tags. Cuando está disponible,
el selector usa exclusivamente modelos instalados. La API repite la
validación antes de crear la partida y el cliente Ollama absorbe conexión
fallida y HTTP 404 con una decisión legal. La píldora de espera quedó centrada
horizontal y verticalmente en la baza.

- Pytest de motor, controladores y proveedores: **94 passed**.
- Validación Ollama y recuperación de sesión: **4 passed**.
- Vitest: **65 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.

## Undécima enmienda: fallback de catálogo para proveedores CLI

Un fallo de `GET /llm/models` ya no etiqueta Codex, Claude u OpenCode como no
disponibles ni deshabilita sus opciones. Codex/Claude usan modelos conocidos y
OpenCode mantiene entrada manual; sólo Ollama depende del preflight estricto.

- Vitest: **66 passed**, incluida la regresión con catálogo HTTP `Not Found`.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.

## Duodécima enmienda: dock adaptable y cartas ampliadas

El dock inferior usa ancho intrínseco cuando está en autoplay, resolviendo o
sin paso pendiente. Conserva los tres controles y elimina los mensajes de
espera duplicados; sólo se expande en manual con una decisión concreta. Las
cartas aumentaron aproximadamente entre 8% y 10%, con límites específicos
para pantallas angostas.

- Vitest: **67 passed**; suite de mesa: **41 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.

## Decimotercera enmienda: identidad fija del motor LLM

La mesa conserva la última configuración válida del motor cuando un snapshot
transitorio omite `engine_config`. Así la etiqueta
`Motor LLM · Codex · modelo predeterminado` no se desmonta ni produce saltos
visuales entre polling, acciones o pasos automáticos.

- Vitest: **68 passed**; suite de mesa: **42 passed**, incluida la regresión
  de snapshot transitorio.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 32 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.

## Decimocuarta enmienda: mezcla, reparto y sonido de mesa

La mesa muestra una secuencia estable de mezcla y reparto al iniciar y al
cambiar la mano. Los dorsos se animan dentro del paño; el audio de cartas se
sintetiza localmente y sólo se reproduce tras activar el botón `Sonido`.

- Vitest: **70 passed**; suite de mesa: **44 passed**, incluidas las fases,
  cantidad de dorsos, finalización y activación accesible del sonido.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.
- Inspección visual automatizada: no disponible porque esta sesión no expuso
  un navegador integrado; el layout responsive queda cubierto por CSS y las
  pruebas DOM.

## Decimoquinta enmienda: vuelo de la carta hacia la baza

La carta jugada se anima desde la mano del agente hasta su casillero calculado
en la baza. La copia final se oculta durante el vuelo, aparece al aterrizar y,
si el sonido está activo, se acompaña con un golpe breve de carta.

- Vitest: **71 passed**; suite de mesa: **45 passed**, incluida la regresión
  origen→vuelo→aterrizaje, ausencia de duplicado y sonido final.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**, partida completa de 182 jugadas, resultado 15–12.

## Decimosexta enmienda: cantos visibles y geometría estable

El paso de respuesta publica ahora el canto vigente y la mesa lo anuncia en
el centro de la baza, incluyendo al jugador que responde. Tras la resolución,
el mensaje se conserva durante 1,8 segundos. Las manos mantienen tres lugares
de carta —reales o vacíos— y los puestos/paño reservan altura suficiente, por
lo que jugar cartas ya no encoge ni expande la mesa.

- Pytest focalizado de metadata del canto: **2 passed**.
- Pytest síncrono de reglas, motores y controladores: **100 passed**.
- Vitest: **73 passed**; suite de mesa: **47 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**, manos y carta jugada visibles en LLM vs LLM y partida
  completa de 182 jugadas, resultado 15–12.
- La suite HTTP con `TestClient` no finaliza bajo Python 3.14.4 en este entorno;
  la integración HTTP equivalente se verificó contra Uvicorn real mediante el
  E2E anterior.

## Decimoséptima enmienda: eventos durables y manos sin parpadeo

Los cantos y sus respuestas ya no dependen del campo efímero
`call_vigente`: el backend conserva eventos numerados y la baza mantiene un
carril exclusivo con `Canto en juego` o `Último canto`. El spinner puede
aparecer simultáneamente. Los polls transitorios sin cartas conservan la última
mano válida cuando no existe una carta nueva que justifique la disminución.

- Pytest focalizado de pasos/eventos: **5 passed**.
- Pytest síncrono de reglas, motores y controladores: **103 passed**.
- Vitest: **74 passed**; suite de mesa: **48 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; verificó `Falta Envido` durable, manos visibles en LLM vs
  LLM y partida completa de 182 jugadas, resultado 15–12.
- El navegador integrado no expuso una instancia en esta sesión; la revisión
  visual se sustituyó por pruebas DOM responsive y el flujo HTTP real.

## Decimoctava enmienda: instancia activa y capas no obstructivas

La repetición del síntoma provenía de un backend iniciado el 25 de agosto sin
recarga, que seguía ejecutando el módulo anterior aunque el repositorio ya
estuviera corregido. Se reinició en el puerto 8000 con `--reload` y se verificó
el JSON vivo. La animación de reparto quedó detrás de manos/baza y el carril de
cantos ahora explica también el caso donde nadie cantó.

- Vitest: **76 passed**; suite de mesa: **50 passed**.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- Backend real: **OK**; `POST /step` publicó `call_vigente=falta_envido`,
  `pending_step.call=falta_envido` y `table_events[0]` con cantor.
- Se verificó que ambas instancias Vite de Truco sirven el componente actual.
- E2E real: **OK**; canto durable, manos visibles y partida completa de 182
  jugadas, resultado 15–12.

## Decimonovena enmienda: historial de cantos como chat

La franja de cantos se convirtió en una conversación de mesa. Cantores y
respondedores aparecen en lados opuestos, cada escalada conserva su orden y el
panel desplaza automáticamente el último mensaje sin cambiar de altura.

- Vitest: **77 passed**; suite de mesa: **51 passed**.
- Regresión específica: cuatro burbujas para Envido → Real Envido → Falta
  Envido → Quiero, con alineación alternada y semántica `role=log`.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; recibió un `Falta Envido` durable y completó 182 jugadas,
  resultado 15–12.

## Vigésima enmienda: chats junto a las manos

El chat central se dividió en un historial propio para cada participante. En
escritorio se ubican en espejo al lado de las manos y en mobile se apilan
debajo; cada uno conserva sólo los mensajes de su autor y muestra localmente
cuándo ese jugador está pensando una respuesta. La baza central recuperó una
altura más compacta y queda libre para las cartas jugadas.

- Vitest completo: **77 passed**; suite focalizada de mesa: **51 passed**.
- Regresión específica: ruteo Ana/Beto, orden global de cuatro eventos,
  posición `top`/`bottom`, estados vacíos e indicador de respuesta local.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; canto durable, manos y carta jugada visibles y partida
  completa de 182 jugadas, resultado 15–12.

## Vigesimoprimera enmienda: marcador dentro de la mesa

El marcador dejó la barra superior y ahora ocupa una placa interior del paño,
responsive y sin solaparse con el puesto superior. Se eliminó el dorso
decorativo de la esquina y el jugador mano recibe un marco dorado completo que
no depende de que también tenga el turno.

- Vitest completo: **78 passed**; suite focalizada de mesa: **52 passed**.
- Regresiones específicas: contención del marcador en ambas vistas, ausencia
  del mazo decorativo y marco exclusivo para el participante mano.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; canto durable, manos y carta jugada visibles y partida
  completa de 182 jugadas, resultado 15–12.

## Vigesimosegunda enmienda: altura igual para cartas y chat

Cada pareja mano/chat hereda ahora una única altura del contenedor del
participante. En desktop ambos miden 180 px y en mobile 168 px; sólo el cuerpo
del chat desplaza sus mensajes, por lo que el panel nunca crece con el
historial.

- Vitest completo: **78 passed**; suite focalizada de mesa: **52 passed**.
- Regresión estructural: los cuatro paneles Ana/Beto, tanto cartas como chat,
  comparten la clase de dimensionamiento `spectator-player-panel`.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; canto durable, manos y carta jugada visibles y partida
  completa de 182 jugadas, resultado 15–12.

## Vigesimotercera enmienda: proveedor y modelo reales

La cabecera ya no completa metadata desde `truco:lastConfig`. Sólo utiliza el
snapshot actual o la configuración persistida con el `matchId`, y omite el
modelo cuando el proveedor lo resuelve externamente. La leyenda ahora dice
`Motor de reglas` y deja de mostrar `modelo predeterminado`.

- Vitest completo: **79 passed**; suite focalizada de mesa: **53 passed**.
- Nueva regresión: una configuración global Codex con `modelo-ajeno` no aparece
  en una partida legacy sin configuración propia.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; canto durable, manos y carta jugada visibles y partida
  completa de 182 jugadas, resultado 15–12.

## Vigesimocuarta enmienda: modelos OpenCode detectados

El CLI OpenCode 1.15.13 devolvió 28 modelos reales y el endpoint local los
publicó correctamente. El problema estaba en una caché independiente de
`ModelPicker`: una respuesta vacía previa quedaba retenida aunque el Lobby ya
hubiera recibido el catálogo válido. Los combos ahora consumen directamente el
catálogo vivo compartido y no usan modelos OpenCode mockeados en producción.

- Verificación real: `opencode models --pure` y
  `/llm/models?provider=opencode` devolvieron **28 modelos**.
- Pytest de proveedores: **23 passed**.
- Vitest completo: **80 passed**; suite focalizada de Lobby: **20 passed**.
- Regresión específica: `openai/gpt-5.6-sol` y `opencode/big-pickle` aparecen
  en motor y asiento; el modelo seleccionado se incluye al crear la partida.
- Lint: **0 errores**, las mismas 3 advertencias preexistentes de Fast Refresh.
- Build: **OK**, 33 módulos transformados.
- E2E real: **OK**; catálogo HTTP disponible y partida completa de 182
  jugadas, resultado 15–12.
