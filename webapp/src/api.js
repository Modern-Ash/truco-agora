const BASE = "";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export function createMatch({
  mode, target_score, players, seed,
  engine, engine_provider, engine_model, step_mode,
}) {
  return req("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode, target_score, players, seed,
      engine, engine_provider, engine_model, step_mode,
    }),
  });
}

export function getState(matchId, player) {
  const q = player ? `?player=${encodeURIComponent(player)}` : "";
  return req(`/matches/${matchId}/state${q}`);
}

export function postStep(matchId) {
  return req(`/matches/${matchId}/step`, { method: "POST" });
}

export function postAction(matchId, action) {
  return req(`/matches/${matchId}/actions`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function postSena(matchId, { de, para, sena }) {
  return req(`/matches/${matchId}/senas`, {
    method: "POST",
    body: JSON.stringify({ de, para, sena }),
  });
}
