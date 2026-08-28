# Spec: reglas verificadas y experiencia mobile-first

Work item Agora: `truco-rules-mobile-cards/rules-and-mobile-table`.

## Objetivo

Alinear la partida con las reglas publicadas del Truco Argentino, hacer explícitas las variantes y
reconstruir la entrada y la baraja para que la experiencia se sienta como una mesa criolla en móvil,
no como un panel web alineado a un borde.

## Fuentes de reglas

- [Juegos Nacionales Evita — Reglamento de Truco 2023](https://www.argentina.gob.ar/sites/default/files/2023/04/truco.pdf): torneo por parejas a 30 puntos, 15 malas y 15 buenas, bajo reglamento ASART.
- [Juegos Bonaerenses — Reglamento de Truco 2026](https://juegos.gba.gob.ar/wp-content/uploads/2026/reglamentos/especificos/deportes_adultos_mayores/truco.pdf): mazo español de 40 cartas, reparto, envites, jerarquía, pardas, truco/retruco/vale cuatro y variante con flor.
- [truco.ar — Reglas del Truco Argentino](https://truco.ar/reglas): resumen de la variante ASART sin flor, partida a 30, jerarquía, envido, falta envido, escalado y pardas.

Las fuentes difieren en una decisión legítima: Juegos Bonaerenses 2026 juega **con flor** y a 40,
mientras que la variante ASART resumida por truco.ar juega **sin flor** y a 30. La app conserva sus
partidas a 15/30 y debe exponer `Sin flor` (default) / `Con flor`; no debe presentar una de las dos
como universal.

## Hallazgos del código actual

1. La jerarquía ubica 7 de copa/basto por encima de 12/11/10. El reglamento ubica primero 12, 11 y
   10, y luego los sietes falsos.
2. La resolución de bazas compara identidad de jugador. En 2v2 debe comparar el **bando**: dos
   compañeros pueden ganar las dos primeras bazas.
3. Una pareja de cartas máximas iguales del mismo equipo hoy puede convertir una baza ganada en
   parda; la igualdad solo emparda si el máximo pertenece a ambos bandos.
4. La fase inicial solo permite iniciar `envido`; el reglamento también permite `real envido` y
   `falta envido` de primera.
5. El motor puede abrir más de una cadena independiente de envido en la misma mano.
6. La respuesta a truco ofrece saltar directamente a vale cuatro y, después de un quiero, cualquier
   bando puede elevar. El escalado debe ser alternado e inmediato: truco → retruco → vale cuatro.
7. La flor está siempre activa y puede ocultarse con “paso”; la variante no está declarada.
8. El prompt del motor LLM reproduce la jerarquía errónea y describe pardas por persona, no por
   bando.
9. El Lobby usa una columna angosta sin un marco visual central fuerte y los controles dependen de
   utilidades desktop. La dirección visual `dark glass/web3` no representa la materialidad del
   Truco criollo.
10. Las cartas son rectángulos con un único pictograma; no tienen orla, pintas, índices duplicados,
    composición de palos ni figuras reconocibles de una baraja española.

## Requisitos funcionales

### Motor y API

- Corregir la jerarquía completa y cubrir cada frontera con tests.
- Resolver bazas y pardas por equipo en 1v1 y 2v2.
- Permitir envido, real envido o falta envido como canto inicial; una mano solo admite una cadena de
  envido.
- Limitar el escalado de truco al siguiente nivel y al equipo que aceptó el canto anterior.
- Agregar `flor_enabled` al contrato de creación, al snapshot y a la revancha.
- Con flor activa, una flor real se declara obligatoriamente y anula el envido. Sin flor, nunca se
  ofrecen cantos de flor.
- Corregir el contexto reglamentario enviado al motor LLM sin cambiar la decisión previamente
  aceptada de usar arbitraje LLM cuando ese motor está seleccionado.

### Lobby mobile-first

- Composición centrada horizontalmente y contenida en un marco de máximo 1040 px.
- Una sola columna desde 320 px; dos columnas solo cuando exista ancho suficiente.
- Controles táctiles de al menos 44 px, labels asociados, foco visible y cero overflow horizontal.
- Regla de flor visible junto a modalidad y puntaje.
- Dirección estética editorial criolla: paño, papel, tinta, filetes y dorado moderado; sin apariencia
  de dashboard web3.

### Pantalla de juego mobile-first (enmienda 2026-08-27)

- La pantalla completa y `#root` deben ocupar el ancho disponible; ningún
  ancestro puede contraer la mesa al contenido.
- Marcador, mazo, cabecera de espectador, paño y controles deben compartir un
  eje central y un contenedor de hasta 1440 px.
- En escritorios anchos la mesa debe quedar centrada, con márgenes laterales
  equivalentes; no puede quedar pegada a la izquierda dejando un vacío a la
  derecha.
- En móvil el contenedor usa el ancho completo con un gutter de 8 px por lado,
  apila los elementos y no produce overflow horizontal.
- El paño del espectador debe usar una altura responsive entre 500 y 700 px en
  escritorio, y un mínimo de 460 px en móvil, manteniendo visibles manos,
  baza y controles.

### Baza vigente y modelos LLM (segunda enmienda 2026-08-27)

- La `Baza en juego` representa únicamente la vuelta vigente: una carta
  visible o un solo lugar pendiente por participante. Las vueltas anteriores
  permanecen disponibles en Historial y no ensanchan el paño central.
- La baza usa un ancho máximo de 46 rem, se centra en el paño y explicita el
  número de vuelta. En móvil ocupa el ancho disponible con gutter de 4 px y
  dos columnas; una mesa 2v2 puede usar cuatro columnas desde 640 px.
- El Lobby debe consultar los modelos realmente utilizables por cada
  proveedor y presentarlos en un selector. Cambiar de proveedor limpia un
  modelo anterior incompatible.
- El backend descubre el catálogo desde el entorno donde corre la API:
  catálogo local de Codex, modelos configurados en OpenCode, tags instalados
  de Ollama y aliases admitidos por Claude Code.
- Si un CLI o servicio no está disponible, la UI muestra el diagnóstico y
  conserva una entrada manual. El descubrimiento no lee ni expone
  credenciales y `mock` no pide modelo.

### Combos de LLM reales (tercera enmienda 2026-08-27)

- `mock` no aparece en los combos del Lobby: es una herramienta determinista
  interna, no un LLM elegible por una persona.
- Codex es el proveedor LLM inicial porque está instalado y entrega catálogo
  en el entorno de la app; los asientos que pasan a agente heredan el mismo
  default.
- El control de modelo permanece siempre como combo. Mientras llega el
  catálogo puede usar opciones conocidas de los CLIs instalados; la respuesta
  dinámica de la API reemplaza ese respaldo y tiene prioridad.
- Claude y Codex deben ofrecer opciones desde el primer render. OpenCode y
  Ollama conservan `Escribir modelo manualmente…` cuando su configuración o
  servicio local no devuelve modelos.

### Identidad LLM y controles estables (cuarta enmienda 2026-08-27)

- El snapshot público identifica el motor de reglas y, para cada jugador
  agente, su proveedor y modelo. Un modelo omitido se presenta honestamente
  como `modelo predeterminado`.
- La mesa muestra `Proveedor · Modelo` debajo del nombre de cada agente tanto
  en vista de espectador como en partidas mixtas. Si el motor de reglas es
  LLM, su identidad aparece en la cabecera de la mesa de agentes.
- En step-mode, el bloque de controles y el botón `Siguiente movida` permanecen
  montados durante toda la partida. El botón se deshabilita mientras se
  resuelve o prepara el próximo paso, pero no desaparece.
- La franja de turno y los controles reservan una altura estable en escritorio
  y móvil. El estado transitorio `pending_step: null` no puede cambiar el ancho
  ni la altura general del paño.

### Estado transitorio compacto (quinta enmienda 2026-08-27)

- La espera entre pasos se comunica como `Preparando siguiente jugada…` en
  una píldora de ancho intrínseco, centrada dentro del mismo `game-shell` de la
  mesa. No usa una barra extensa ni el pulso amarillo reservado al turno real.
- El wrapper conserva la altura de la franja de turno para evitar layout
  shift, pero el estado transitorio usa menor contraste y no proyecta sombra.

### Identidad LLM visible y compatible (sexta enmienda 2026-08-27)

- Cada puesto agente dentro del paño muestra una chapa legible
  `LLM · Proveedor · Modelo`, con contraste, borde y tamaño suficientes para
  distinguirla de las etiquetas `MANO` y `JUGANDO`.
- La configuración de creación se persiste también por `match_id`. Si una
  partida fue creada con una versión de API que aún no publica `agent` o
  `engine_config`, la mesa recupera proveedor/modelo desde esa configuración.
- El fallback sólo se aplica si los nombres guardados coinciden exactamente
  con los participantes del snapshot, evitando atribuir metadata de otra
  partida. La metadata entregada por la API siempre tiene prioridad.

### Indicadores de espera (séptima enmienda 2026-08-27)

- Apertura de mesa, reconexión, preparación entre pasos y resolución de una
  jugada muestran el mismo spinner discreto junto al texto que explica la
  espera. El indicador no aparece cuando la próxima movida ya está lista.
- Durante una resolución, el panel de step-mode conserva visible el botón
  `Siguiente movida`, lo deshabilita y prioriza el estado
  `Resolviendo la jugada…` aunque el snapshot anterior aún tenga
  `pending_step`.
- El spinner reserva dimensiones fijas para no producir layout shift, es
  decorativo para lectores de pantalla porque el texto contiguo ya comunica
  el estado, y deja de rotar con `prefers-reduced-motion`.

### Continuidad ante fallos de proveedor (octava enmienda 2026-08-27)

- La indisponibilidad temporal de un CLI, servicio local o modelo de un
  jugador LLM no finaliza la partida ni publica `finished: true` con ganador
  vacío.
- Ante una excepción del proveedor, el controlador registra una advertencia
  y elige de forma determinista la primera opción legal ya construida por el
  motor. El fallback no puede agregar decisiones fuera del conjunto válido.
- Los fallos fatales internos conservan el estado `Partida interrumpida`; el
  fallback se limita a la frontera de decisión del proveedor externo.
- Una partida completa con los dos proveedores de jugadores inaccesibles
  debe alcanzar el puntaje objetivo y producir un ganador sin propagar la
  excepción al hilo de sesión.

### Recuperación de sesión y espera dentro del paño (novena enmienda 2026-08-27)

- El hilo de sesión protege además el límite de cada mano: ante una excepción
  que atravesó la frontera del proveedor, descarta la mano incompleta y la
  reintenta hasta tres veces conservando marcador y objetivo. Sólo tres fallos
  consecutivos publican un error fatal.
- Mientras reintenta, el snapshot usa `recovering: true`, mantiene
  `finished: false` y no inventa ganador. Al completar una mano limpia borra
  el diagnóstico transitorio y reinicia el contador de fallos.
- En la vista LLM vs LLM no se reserva una franja de turno sobre el paño. El
  spinner de preparación, resolución o recuperación reemplaza temporalmente
  la etiqueta `Baza en juego` dentro de la propia mesa, en una píldora de
  ancho intrínseco.
- El panel de avance conserva el botón `Siguiente movida`, pero no duplica el
  spinner. Un error realmente fatal muestra su diagnóstico debajo de
  `Partida interrumpida`.

### Ollama verificado y espera centrada (décima enmienda 2026-08-27)

- El Lobby consulta todos los catálogos para mostrar diagnóstico. Sólo Ollama
  condiciona su habilitación al resultado: aparece deshabilitado si
  `/api/tags` no responde o no devuelve al menos un modelo instalado.
- Ollama no ofrece `modelo predeterminado` ni entrada manual: al habilitarse,
  el combo selecciona un tag instalado y sólo permite elegir entre los tags
  devueltos por el servicio.
- `POST /matches` vuelve a validar Ollama antes de repartir y responde 422 si
  el servicio/modelo no está disponible, si falta el modelo o si el tag no
  pertenece al catálogo instalado.
- Una caída de conexión o HTTP 404 dentro de una decisión Ollama usa la
  primera opción legal como fallback y nunca propaga
  `ProviderUnavailableError` al hilo de sesión.
- La píldora de preparación/resolución se centra en ambos ejes dentro de la
  baza, sobre la división entre participantes, y conserva ancho intrínseco.

### Catálogo opcional para proveedores CLI (undécima enmienda 2026-08-27)

- Codex, Claude y OpenCode permanecen seleccionables aunque
  `GET /llm/models` responda 404, falle o no pueda localizar el CLI desde el
  proceso de la API. La consulta del catálogo es informativa, no un health
  check de esos proveedores.
- Si el catálogo no está disponible, Codex y Claude conservan sus opciones
  conocidas; OpenCode conserva la entrada manual. El selector muestra una
  advertencia sin agregar `no disponible` al nombre del proveedor.
- El bloqueo preventivo sigue aplicándose exclusivamente a Ollama porque su
  ejecución depende de un servicio HTTP local y de tags instalados
  enumerables.

### Dock inferior adaptable y cartas ampliadas (duodécima enmienda 2026-08-27)

- El panel inferior de step-mode se colapsa automáticamente al ancho de sus
  controles cuando autoplay está activo, una jugada se está resolviendo o no
  existe `pending_step`. `Siguiente movida`, `Automático` y el delay siempre
  permanecen visibles y con targets táctiles de al menos 44 px.
- En estado colapsado no repite `Preparando la próxima movida…` ni
  `Resolviendo la jugada…`; esos estados viven exclusivamente en la píldora
  con spinner dentro de la baza.
- Al desactivar autoplay, el dock se expande sólo si existe una próxima
  decisión concreta y muestra jugador/tipo. Al volver a autoplay se colapsa
  sin intervención adicional.
- Mano propia, manos de espectador, cartas jugadas y cartas de la baza crecen
  moderadamente, conservando proporción española, composición de tres cartas
  y un tamaño específico menor debajo de 390 px.

### Identidad fija del motor LLM (decimotercera enmienda 2026-08-27)

- La cabecera conserva de forma permanente la última configuración válida del
  motor durante toda la partida: `Motor LLM · proveedor · modelo`.
- Un snapshot transitorio de polling, acción o step-mode que omita
  `engine_config` no debe desmontar la etiqueta ni alterar la altura de la
  cabecera; la configuración sólo se reemplaza cuando llega un nuevo valor
  explícito.
- Si el motor no declara un modelo, la etiqueta estable usa
  `modelo predeterminado`, por ejemplo
  `Motor LLM · Codex · modelo predeterminado`.

### Mezcla, reparto y sonido de mesa (decimocuarta enmienda 2026-08-27)

- Al abrir una partida y cada vez que cambia la mano, el paño representa dos
  fases consecutivas sin modificar el tamaño de la mesa: `Mezclando el mazo…`
  con dorsos españoles barajándose y `Repartiendo cartas…` con dorsos que
  viajan desde el centro hacia los puestos.
- El estado usa `role=status`, `aria-live=polite` y permanece dentro del paño;
  no desplaza el marcador, la identidad del motor ni los controles de paso.
- `prefers-reduced-motion` sustituye los vuelos por una composición estática,
  conservando ambos mensajes y la duración funcional de la transición.
- La vista LLM ofrece un botón `Sonido` con `aria-pressed`. El audio está
  desactivado inicialmente, se habilita sólo mediante gesto del usuario y la
  preferencia queda guardada localmente.
- Mezcla y reparto usan efectos cortos sintetizados con Web Audio, sin
  descargar recursos ni reproducir sonido cuando el navegador no lo permite.

### Vuelo de la carta hacia la baza (decimoquinta enmienda 2026-08-27)

- En la mesa de agentes, cada incremento de `played` genera una transición
  espacial desde el centro de la mano del jugador hasta su casillero real en
  la baza; las coordenadas se calculan en cada jugada para adaptarse a 1v1,
  2v2 y anchos móviles.
- La carta describe un arco corto con elevación, escala y giro leve antes de
  asentarse, imitando el gesto físico de tirar una carta sobre el paño.
- La carta final permanece oculta mientras vuela la copia animada y aparece al
  aterrizar, evitando duplicados o saltos. Si la jugada es tapada, vuela el
  dorso español.
- Una carta que llegue durante la animación del reparto queda pendiente y
  vuela apenas se despeja el paño.
- Con sonido habilitado, el aterrizaje reproduce un golpe corto sintetizado.
  Con `prefers-reduced-motion`, se omite el vuelo y la carta aparece
  directamente en la baza.
- El movimiento anuncia de forma no intrusiva qué jugador tiró qué carta
  mediante `role=status` y contenido exclusivo para lectores de pantalla.

### Cantos visibles y geometría estable (decimosexta enmienda 2026-08-27)

- Cuando un agente espera una respuesta, el paso pendiente conserva el canto
  concreto (`envido`, `real_envido`, `truco`, `retruco`, flor, etc.) desde el
  controlador hasta el snapshot HTTP; la interfaz no debe inferirlo por texto.
- La baza muestra el canto y quién debe responder con `aria-live=polite`. Al
  resolverse permanece como `Último canto` con la respuesta registrada, en vez
  de desaparecer al llegar el siguiente snapshot.
- Cada puesto reserva siempre tres lugares del tamaño real de una carta. Las
  cartas ya jugadas dejan una silueta vacía, por lo que una mano con dos, una
  o cero cartas no reduce el puesto ni redistribuye la altura del paño.
- El paño y los puestos tienen alturas mínimas responsive compatibles con la
  baraja ampliada. Cambiar de paso, resolver un canto o vaciar una mano no debe
  producir saltos de ancho o alto.

### Eventos durables y manos sin parpadeo (decimoséptima enmienda 2026-08-27)

- La sesión conserva una secuencia monotónica `table_events` con cada canto y
  respuesta. Incluye jugador, nombre normalizado del canto y respuesta, por lo
  que el polling no depende de alcanzar el breve instante de `call_vigente`.
- `Preparando jugada…` y el canto ocupan carriles independientes dentro de la
  baza: el spinner nunca reemplaza ni oculta `Canto en juego`/`Último canto`.
- En vivo se muestra quién debe responder. Una vez resuelto, se muestra quién
  respondió y si dijo `Quiero`, `No quiero` o la variante correspondiente.
- Durante un `pending_step: null` transitorio, una mano vacía sin incremento
  correlativo de cartas jugadas se considera un snapshot incompleto y conserva
  la última mano válida. Una disminución real de mano acompañada por una nueva
  carta en la baza sí se representa normalmente.
- La franja reservada para cantos existe siempre, evitando que Envido, Falta
  Envido, Truco, Retruco, Flor y sus respuestas redimensionen el paño.

### Compatibilidad de instancia y capas no obstructivas (decimoctava enmienda 2026-08-27)

- La animación de mezcla/reparto se descompone por capas: halo y dorsos quedan
  detrás de puestos y baza, mientras sólo su mensaje informativo puede quedar
  por delante. Nunca debe ocultar imágenes de manos, cantos o respuestas.
- El carril de cantos siempre contiene un estado explícito. Antes del primer
  canto dice `Sin cantos todavía`; así la ausencia de Truco/Envido comunica una
  decisión real de los agentes y no parece un fallo de render.
- Si un backend antiguo no publica `table_events`, la mesa muestra
  `Servidor sin registro de cantos · reiniciá el backend` en vez de fallar en
  silencio. La advertencia desaparece automáticamente con una API compatible.
- El entorno de desarrollo debe ejecutar el backend con recarga automática o
  reiniciarlo después de cambios Python. La verificación se realiza contra el
  proceso real del puerto 8000 y exige un evento de `Falta Envido` completo.

### Historial conversacional de cantos (decimonovena enmienda 2026-08-27)

- `table_events` se presenta dentro de la baza como un chat cronológico. Cada
  canto y cada respuesta es una burbuja separada con nombre del participante,
  texto humano (`cantó ¡Truco!`, `respondió Quiero`) y canto relacionado.
- Las burbujas se alinean a izquierda/derecha según el lado del jugador, con
  colores diferenciados pero coherentes con la paleta del paño.
- El panel conserva una altura fija de 92 px, tiene scroll vertical y avanza
  automáticamente al evento más reciente sin alterar manos, baza o controles.
- La conversación muestra escaladas completas en orden —por ejemplo Envido,
  Real Envido, Falta Envido, Quiero— y mantiene `role=log`, `aria-live=polite`
  y `aria-relevant=additions` para lectores de pantalla.
- Sin eventos conserva el mensaje `Sin cantos todavía`; con un backend antiguo
  puede representar el canto vigente como una burbuja de compatibilidad.

### Chats junto a las manos (vigésima enmienda 2026-08-27)

- El historial deja de ocupar el centro del paño: cada participante dispone de
  su propio chat inmediatamente al lado de la mano para relacionar sin ambigüedad
  la voz, el agente LLM y las cartas que conserva.
- En escritorio, el chat del puesto superior queda a su derecha y el del puesto
  inferior a su izquierda, formando una composición espejo. En pantallas
  angostas ambos chats pasan debajo de su mano sin desbordar el paño.
- Cada chat filtra sólo los eventos pronunciados por ese participante, pero
  conserva el identificador global del evento para que el orden de la
  conversación siga siendo auditable.
- El jugador que debe contestar muestra `Respondiendo…` y un spinner dentro de
  su propio chat. Antes del primer canto, cada panel dice `Todavía no cantó`.
- Los paneles tienen dimensiones reservadas y scroll independiente; sumar un
  canto o cambiar de turno no redimensiona la mano, la baza ni los controles.
- El centro vuelve a dedicarse exclusivamente a la carta jugada y al estado de
  resolución, haciendo la mesa más compacta y la conversación más visible.

### Marcador integrado y jugador mano (vigesimoprimera enmienda 2026-08-27)

- El marcador tradicional de cerillos forma parte del paño: en la vista de
  espectadores ocupa la esquina superior izquierda de la mesa y equilibra el
  puesto superior; en la vista del jugador queda contenido por el escenario de
  juego. Ya no existe una barra superior independiente.
- En anchos intermedios el encabezado interior reduce sus columnas y en mobile
  el marcador se apila antes del puesto superior, siempre dentro del borde de
  la mesa y sin superponerse con cartas o chats.
- Se elimina el dorso decorativo que simulaba un mazo en la esquina superior
  derecha. Los únicos dorsos visibles son los que participan realmente del
  reparto, las cartas tapadas o sus animaciones.
- El participante que tiene la mano recibe un marco dorado completo, halo leve
  y fondo cálido además de la etiqueta `MANO`. La indicación permanece aunque
  el turno pase a otro jugador y convive con el borde turquesa de `JUGANDO`.
- La misma semántica se aplica a puestos de espectador, rivales/compañeros y a
  la zona de cartas propia, de modo que el rol de mano sea reconocible en todos
  los modos de partida.

### Altura unificada de mano y chat (vigesimosegunda enmienda 2026-08-27)

- El panel de cartas y el historial de cantos de cada participante comparten
  una única medida de altura declarada en su contenedor: 180 px en escritorio
  y 168 px en mobile.
- Ambos paneles usan la misma clase estructural, evitando que sus alturas
  diverjan cuando cambia el contenido, el estado de mano o la cantidad de
  mensajes.
- El encabezado del chat conserva su altura y el cuerpo ocupa el espacio
  restante con scroll vertical. Una conversación extensa no estira el panel
  ni modifica la geometría del puesto.
- Al apilarse en mobile, cartas y chat mantienen la misma altura aunque cambie
  el eje flex; el ancho del chat sigue adaptándose al espacio disponible.

### Identidad real del motor de reglas (vigesimotercera enmienda 2026-08-27)

- La cabecera `Mesa de agentes · Vista en vivo` obtiene proveedor y modelo
  exclusivamente del `engine_config` publicado por la partida o, para APIs
  antiguas, de `truco:config:<matchId>`.
- `truco:lastConfig` no puede completar metadata de una partida: es una
  preferencia global y puede corresponder a otro match que reutilice nombres.
  Esto evita inyectar Codex o cualquier modelo ajeno en mesas compartidas.
- La etiqueta se denomina `Motor de reglas` y sólo aparece cuando existe un
  proveedor verificable. El nombre del proveedor se normaliza para lectura,
  pero nunca se sustituye por un valor fijo.
- Si el snapshot incluye modelo, se muestra exactamente ese valor. Si el
  proveedor resuelve su modelo mediante configuración externa, se omite el
  modelo en lugar de afirmar `modelo predeterminado`.
- Las insignias individuales mantienen la misma regla: proveedor real y modelo
  únicamente cuando está presente en la metadata de ese participante.

### Catálogo vivo de OpenCode (vigesimocuarta enmienda 2026-08-27)

- El backend descubre modelos con `opencode models --pure`, acepta identificadores
  `proveedor/modelo` y los expone sin mocks mediante `GET /llm/models?provider=opencode`.
- El Lobby precarga un catálogo único por proveedor y lo entrega directamente
  a todos los selectores del motor y de los asientos. `ModelPicker` no mantiene
  una segunda caché de módulo que pueda congelar una respuesta vacía anterior.
- Cambiar a OpenCode actualiza inmediatamente el combo con los modelos del
  catálogo vivo. El mismo conjunto aparece en el motor de reglas y en cada
  participante LLM durante esa sesión del Lobby.
- El modelo seleccionado se guarda en `engine_model` o en `players[].model`, se
  envía al backend y luego figura en la identidad correspondiente de la mesa.
- Si el endpoint falla o el CLI no devuelve modelos, permanece disponible la
  entrada manual; no se inventa una lista estática de modelos OpenCode.

### Baraja española

- Un componente compartido debe renderizar mano, espectadores y baza en tamaños diferentes.
- Cada carta lleva doble índice, orla, textura de papel y palos españoles dibujados en SVG.
- Las cartas numéricas muestran una composición de pintas; 10/11/12 se distinguen como Sota,
  Caballo y Rey mediante una figura ornamental.
- El dorso debe ser propio de la baraja y no depender del glifo Unicode del sistema.
- Texto accesible `N de palo`, contraste suficiente y animación desactivable por
  `prefers-reduced-motion`.

## Fuera de alcance

- 3v3, pica-pica, maldón, penalizaciones físicas de reparto o lenguaje de mesa.
- Cambiar los targets existentes de 15/30 a la variante bonaerense de 40.
- Sustituir el sistema de proveedores LLM o el polling multijugador.

## Criterios de aceptación

- `rules-audit`, `core-rules`, `flor-variant`, `mobile-lobby`, `spanish-deck` y `verification`
  definidos en el work item original de Agora.
- `game-centering`, `game-responsive` y `game-verification` definidos en la
  enmienda `truco-game-screen-layout/centered-game-screen` de la misma spec.
- `current-trick-layout`, `provider-model-discovery`,
  `model-picker-fallback` y `amendment-verification` definidos en la enmienda
  `truco-trick-model-catalog/trick-and-model-picker` de la misma spec.
- `real-provider-options`, `immediate-model-options` y
  `provider-combo-verification` definidos en la enmienda
  `truco-real-model-combos/real-model-combos` de la misma spec.
- `llm-match-identity`, `stable-step-controls` y `stable-refresh-verification`
  definidos en la enmienda
  `truco-llm-identity-stable-controls/llm-identity-and-controls`.
- `compact-transition-status` y `transition-status-verification` definidos en
  `truco-compact-transition-status/compact-transition-status`.
- `visible-llm-badges`, `legacy-metadata-fallback` y
  `llm-badge-verification` definidos en
  `truco-visible-llm-badges/visible-llm-badges`.
- `waiting-spinner-states`, `reduced-motion-spinner` y
  `spinner-verification` definidos en
  `truco-waiting-spinners/waiting-spinners`.
- `provider-failure-continuity`, `legal-decision-fallback` y
  `continuity-verification` definidos en
  `truco-provider-failure-continuity/provider-failure-continuity`.
- `session-hand-recovery`, `in-table-wait-status` y
  `recovery-layout-verification` definidos en
  `truco-session-recovery-compact-wait/session-recovery-compact-wait`.
- `ollama-preflight`, `ollama-runtime-fallback`, `centered-wait-pill` y
  `ollama-verification` definidos en
  `truco-ollama-preflight-centered-wait/ollama-preflight-centered-wait`.
- `cli-provider-selection`, `catalog-fallback-labels` y
  `cli-catalog-verification` definidos en
  `truco-cli-catalog-fallback/cli-catalog-fallback`.
- `auto-collapsing-step-dock`, `single-wait-message`, `larger-spanish-cards` y
  `compact-dock-verification` definidos en
  `truco-compact-dock-larger-cards/compact-dock-larger-cards`.
- `persistent-engine-identity` y `engine-identity-verification` definidos en
  `truco-stable-engine-identity/stable-engine-identity`.
- `shuffle-deal-visual`, `optional-table-sound`,
  `deal-sequence-accessibility` y `deal-sequence-verification` definidos en
  `truco-deal-sequence-sound/deal-sequence-sound`.
- `spatial-card-flight`, `single-card-landing`,
  `card-flight-accessibility` y `card-flight-verification` definidos en
  `truco-card-flight-transition/card-flight-transition`.
- `step-call-metadata`, `visible-call-announcement`,
  `stable-hand-geometry` y `call-hand-verification` definidos en
  `truco-visible-calls-stable-hands/visible-calls-stable-hands`.
- `durable-table-events`, `independent-status-lanes`,
  `transient-hand-retention` y `durable-events-verification` definidos en
  `truco-durable-calls-stable-snapshots/durable-calls-stable-snapshots`.
- `runtime-version-warning`, `non-obscuring-deal-layer`,
  `explicit-no-call-status` y `live-server-verification` definidos en
  `truco-live-runtime-call-visibility/live-runtime-call-visibility`.
- `chat-call-history`, `side-aligned-bubbles`,
  `auto-scroll-fixed-geometry` y `chat-history-verification` definidos en
  `truco-call-chat-history/call-chat-history`.
- `adjacent-player-chat`, `participant-message-routing`,
  `responsive-chat-placement` y `adjacent-chat-verification` definidos en
  `truco-adjacent-player-call-chat/adjacent-player-call-chat`.
- `in-table-scoreboard`, `decorative-deck-removal`, `mano-player-frame` y
  `table-scoreboard-verification` definidos en
  `truco-integrated-scoreboard-mano-frame/integrated-scoreboard-mano-frame`.
- `equal-hand-chat-height`, `shared-panel-sizing`,
  `scroll-within-equal-height` y `equal-panel-verification` definidos en
  `truco-equal-hand-chat-height/equal-hand-chat-height`.
- `match-scoped-engine-identity`, `no-global-config-injection`,
  `honest-optional-model` y `engine-identity-verification` definidos en
  `truco-real-engine-identity/real-engine-identity`.
- `live-opencode-catalog`, `shared-catalog-source`,
  `selected-opencode-model-flow` y `opencode-catalog-verification` definidos en
  `truco-opencode-live-models/opencode-live-models`.
