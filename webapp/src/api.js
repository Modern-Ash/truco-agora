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
  team_names, team_bluff_levels, flor_enabled,
}) {
  return req("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode, target_score, players, seed,
      engine, engine_provider, engine_model, step_mode,
      team_names, team_bluff_levels, flor_enabled,
    }),
  });
}

export function getLLMModels(provider) {
  const params = new URLSearchParams({ provider });
  return req(`/llm/models?${params}`);
}

export function getState(matchId, player, spectator = false) {
  const params = new URLSearchParams();
  if (player) params.set("player", player);
  if (spectator) params.set("spectator", "true");
  const q = params.size ? `?${params}` : "";
  return req(`/matches/${matchId}/state${q}`);
}

export function postStep(matchId, source = "manual") {
  return req(`/matches/${matchId}/step`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });
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
