/** Nombre visible de un lado de la mesa.
 *
 * En 1v1 el "equipo" es la persona, incluso si una partida anterior conserva
 * un nombre colectivo interno. En 2v2 sí se muestra la colectividad.
 */
export function teamDisplayName(team) {
  const members = team?.players || [];
  if (members.length === 1) {
    const member = members[0];
    return typeof member === "string" ? member : member?.name || team.name;
  }
  return team?.name || "";
}

export function winnerDisplayName(teams, winner) {
  if (!winner) return winner;
  const team = (teams || []).find((candidate) => candidate.name === winner);
  return team ? teamDisplayName(team) : winner;
}
