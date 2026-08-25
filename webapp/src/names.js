/** Nombres por defecto para el Lobby: equipos (colectividad) y jugadores
 * (humano al azar, o robot/IA si el asiento es un agente LLM). */

export const NOMBRES_EQUIPOS = [
  "Boca", "River", "Racing", "Independiente", "San Lorenzo",
  "Rosario", "Mendoza", "Córdoba", "Salta", "Tucumán",
  "Patagonia", "La Pampa",
];

export const NOMBRES_HUMANOS = [
  "Fede", "Sofi", "Nico", "Vale", "Tomi", "Juli",
  "Santi", "Cami", "Bruno", "Agus", "Lauti", "Mica",
];

export const NOMBRES_AGENTES = [
  "CPU-Ñ7", "Bot Basto", "Androide-3", "RoboTruco", "Máquina-9",
  "Ciborg-Espada", "Unidad-42", "IA-Malas",
];

/** Elige `count` elementos distintos de `pool` sin reemplazo. */
export function pickUnique(pool, count) {
  const copy = [...pool];
  const out = [];
  for (let i = 0; i < count && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

/** Elige un nombre de `pool` evitando los ya usados en `excluded`. */
export function pickName(pool, excluded = []) {
  const filtered = pool.filter((n) => !excluded.includes(n));
  const source = filtered.length ? filtered : pool;
  return pickUnique(source, 1)[0];
}

export function poolFor(kind) {
  return kind === "agent" ? NOMBRES_AGENTES : NOMBRES_HUMANOS;
}
