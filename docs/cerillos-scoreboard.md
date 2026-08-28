# Spec: marcador tradicional de cinco cerillos

## Objetivo

Reemplazar el marcador numérico compacto por la forma tradicional de anotar
el Truco: cada punto agrega un cerillo y cada grupo de cinco se representa con
cuatro lados de un cuadrado más una diagonal.

## Representación

- Los cerillos se dibujan como SVG propio del componente: madera clara, borde
  oscuro y cabeza roja. No dependen de imágenes, fuentes de iconos ni red.
- Dentro de cada grupo, los puntos se agregan en este orden: lateral izquierdo,
  borde superior, lateral derecho, borde inferior y diagonal.
- Una partida a 15 dispone tres grupos de cinco por equipo.
- Una partida a 30 dispone dos franjas por equipo: `Malas` conserva los
  primeros 15 puntos y `Buenas` representa los puntos 16 a 30.
- El número exacto permanece junto al nombre del equipo para lectura rápida.
- El equipo ganador conserva el estado visual y textual de campeón.

## Layout y accesibilidad

- Los dos equipos se muestran enfrentados en una grilla de dos columnas.
- Cada franja mantiene tres espacios estables para evitar saltos al sumar.
- La anotación tiene un nombre accesible que incluye equipo, franja y cantidad
  de puntos; los trazos SVG individuales son decorativos.
- En pantallas angostas disminuye el tamaño de los cerillos sin convertir el
  marcador en scroll horizontal ni desplazar la mesa fuera del viewport.

## Criterios de aceptación

- Cinco puntos forman cuatro lados y una diagonal; nueve forman un grupo de
  cinco y otro de cuatro.
- A 15 se representan correctamente valores de 0 a 15.
- A 30, 16 se representa como 15 malas y 1 buena; 30 como dos franjas completas.
- Nombre, número exacto, malas/buenas y ganador siguen disponibles en texto.
- Pasan pruebas web, build, lint y E2E sin cambiar el cálculo de puntaje.
