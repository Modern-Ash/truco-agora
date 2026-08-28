# Swarm 032 — picardía por jugador o equipo

## Objetivo

Permitir que una mesa 2v2 configure la estrategia de farol de dos maneras:

- **Por jugador:** cada agente LLM conserva su perfil individual.
- **Por equipo:** los asientos 1 y 3 comparten un perfil, y los asientos 2 y
  4 comparten otro.

En 1v1 se mantiene únicamente la configuración individual porque cada equipo
contiene una sola persona.

## Resolución y precedencia

La API acepta `team_bluff_levels` con dos valores para partidas 2v2. Para cada
agente, el nivel efectivo se resuelve en este orden:

1. `players[i].bluff_level` explícito.
2. `team_bluff_levels[i % 2]`.
3. `equilibrado` como valor predeterminado.

Los valores válidos siguen siendo `cauteloso`, `equilibrado` y `mentiroso`.
El snapshot publica el nivel efectivo y si provino del jugador, del equipo o
del default. El motor de reglas no cambia.

## Interfaz

El Lobby 2v2 ofrece un selector `Por jugador / Por equipo`. En modo equipo se
muestran dos bloques compactos, identificados también por sus asientos, y los
controles individuales se reemplazan por una indicación de herencia.

Durante la partida, cada agente muestra dos insignias juntas:

- identidad del proveedor/modelo;
- `Picardía · <nivel>` con una señal cromática estable.

La insignia aparece tanto en vista de espectador como en la vista del jugador,
sin aumentar la altura mínima de los paneles.
