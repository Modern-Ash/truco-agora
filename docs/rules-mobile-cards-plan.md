# Plan: reglas verificadas y experiencia mobile-first

1. Agregar tests de regresión para ranking, bazas 2v2, pardas por bando, envites iniciales,
   cadena única, escalado alternado y configuración de flor.
2. Corregir `cards.py`, `engine.py`, controladores, API y contexto del motor LLM manteniendo
   compatibilidad con 1v1/2v2.
3. Exponer `flor_enabled` en Lobby, API, snapshots, almacenamiento de revancha y documentación.
4. Crear componentes reutilizables `SpanishCard`/`CardBack` y enriquecer los SVG de palos.
5. Reestructurar el Lobby con CSS mobile-first y actualizar el sistema visual del paño y controles.
6. Reutilizar la nueva carta en manos, vista de espectadores y cartas jugadas.
7. Ejecutar tests Python, Vitest, lint, build y E2E; documentar resultados y cerrar el ciclo Agora
   con artifacts, evidence y aprobación.
8. Enmienda de pantalla de juego: asegurar ancho completo en `#root`, centrar
   marcador/paño/controles en un shell común de 1440 px y repetir la
   verificación responsive.
9. Segunda enmienda: reducir la baza al estado de la vuelta vigente, agregar
   descubrimiento de modelos por proveedor, selector con fallback manual y
   verificar API, componentes y flujo HTTP real.
10. Tercera enmienda: quitar `mock` de los combos, usar Codex como proveedor
    inicial y mantener siempre visible el combo de modelos con catálogo
    dinámico y opciones conocidas de respaldo.
11. Cuarta enmienda: publicar proveedor/modelo en el snapshot, mostrarlos en
    la mesa y estabilizar franja de turno y controles durante el intervalo
    transitorio entre pasos.
12. Quinta enmienda: convertir el aviso transitorio en una píldora compacta,
    centrada y de bajo contraste sin perder la altura reservada.
13. Sexta enmienda: reforzar la chapa LLM en cada puesto y persistir la
    configuración por partida para completar metadata ausente en snapshots
    de APIs anteriores.
14. Séptima enmienda: unificar los indicadores de espera en apertura,
    reconexión y step-mode con dimensiones estables y movimiento reducible.
15. Octava enmienda: aislar fallos de proveedores externos en el controlador
    LLM, degradar a una decisión legal determinista y verificar una partida
    completa con ambos proveedores inaccesibles.
16. Novena enmienda: reintentar manos fallidas en el hilo de sesión, publicar
    el estado transitorio de recuperación y mover el spinner de step-mode a
    la etiqueta de la baza dentro del paño.
17. Décima enmienda: precargar disponibilidad de proveedores, limitar Ollama
    a tags instalados, validar su configuración en la API, absorber sus 404
    en runtime y centrar el estado de espera dentro de la baza.
18. Undécima enmienda: separar catálogo de health check para proveedores CLI,
    mantener Codex/Claude/OpenCode seleccionables ante 404 y reservar el
    bloqueo preventivo exclusivamente para Ollama.
19. Duodécima enmienda: colapsar automáticamente el dock inferior en autoplay
    y estados transitorios, eliminar mensajes de espera duplicados y ampliar
    moderadamente la baraja con ajuste responsive.
20. Decimotercera enmienda: conservar la última identidad válida del motor LLM
    entre snapshots de polling, acciones y step-mode, y cubrir la ausencia
    transitoria de `engine_config` con una prueba de regresión.
21. Decimocuarta enmienda: representar mezcla y reparto con dorsos españoles
    dentro del paño, anunciar ambas fases de manera accesible y sumar audio
    sintetizado opt-in con persistencia y fallback silencioso.
22. Decimoquinta enmienda: medir mano y casillero de baza en cada jugada para
    animar la carta sobre un arco físico, ocultar su destino hasta el
    aterrizaje y producir un golpe corto cuando el sonido está activo.
23. Decimosexta enmienda: propagar el canto en el paso pendiente, mantener su
    anuncio durante la resolución y reservar tres lugares de carta por puesto
    para que las manos y el paño conserven su geometría durante toda la mano.
24. Decimoséptima enmienda: registrar cantos y respuestas como eventos
    monotónicos, separar su carril del spinner y retener la última mano válida
    cuando un poll transitorio no trae cartas ni una jugada correlativa.
25. Decimoctava enmienda: detectar APIs antiguas, mantener siempre un estado
    explícito de cantos, colocar reparto detrás de manos/baza y verificar la
    versión cargada por los servidores locales reales.
26. Decimonovena enmienda: transformar eventos de canto/respuesta en un chat
    cronológico, alinear burbujas por lado y auto-desplazar un panel de altura
    fija hacia el mensaje más reciente.
27. Vigésima enmienda: dividir el historial por participante, colocar cada chat
    junto a su mano con composición espejo, apilarlo en mobile y devolver el
    centro del paño exclusivamente a la baza y su estado de espera.
28. Vigesimoprimera enmienda: integrar el marcador de cerillos dentro del paño,
    eliminar el mazo decorativo superior y enmarcar en dorado al participante
    mano en las vistas de espectador y jugador.
29. Vigesimosegunda enmienda: definir una altura compartida para el panel de
    cartas y su chat adyacente, con una medida responsive única y scroll
    interior que preserve la geometría del puesto.
30. Vigesimotercera enmienda: limitar el enriquecimiento de proveedor/modelo a
    la configuración del `matchId`, retirar el fallback global y presentar la
    identidad del motor sin valores inventados cuando el modelo es externo.
31. Vigesimocuarta enmienda: eliminar la caché paralela de `ModelPicker`, usar
    el catálogo vivo precargado por el Lobby para motor/asientos y verificar el
    recorrido completo del modelo OpenCode seleccionado hasta la partida.
