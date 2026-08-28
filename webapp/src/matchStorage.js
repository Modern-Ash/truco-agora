export function seatKey(matchId) {
  return `truco:seat:${matchId}`;
}

export function spectatorKey(matchId) {
  return `truco:spectator:${matchId}`;
}

export function matchConfigKey(matchId) {
  return `truco:config:${matchId}`;
}
