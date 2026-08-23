const PALO_GLYPH = { oro: "🟡", copa: "🏆", basto: "🌿", espada: "⚔️" };
const PALO_NAME = { oro: "Oro", copa: "Copa", basto: "Basto", espada: "Espada" };

export function paloGlyph(palo) {
  return PALO_GLYPH[palo] || palo;
}

export function paloName(palo) {
  return PALO_NAME[palo] || palo;
}
