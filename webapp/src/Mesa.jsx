import React, { useCallback, useState } from "react";
import { getState } from "./api.js";
import { usePolling } from "./hooks.js";
import Table from "./components/Table.jsx";
import Spinner from "./components/Spinner.jsx";
import { matchConfigKey, seatKey, spectatorKey } from "./matchStorage.js";
import { teamDisplayName } from "./teamNames.js";

export { seatKey } from "./matchStorage.js";

async function getSpectatorState(matchId) {
  const snapshot = await getState(matchId, undefined, true);
  const players = snapshot.others || [];

  // Compatibilidad con APIs que ya soportaban step-mode pero todavía no
  // incluían las manos en el snapshot de espectador. Cada vista individual
  // sí contiene `you.hand`, así que reconstruimos la mesa sin obligar a
  // reiniciar/actualizar el backend antes de poder verla.
  if (players.every((player) => Array.isArray(player.hand))) return snapshot;

  const names = (snapshot.teams || []).flatMap((team) => team.players || []);
  const playerViews = await Promise.all(
    names.map((name) => getState(matchId, name))
  );
  const hands = new Map(
    playerViews
      .filter((view) => view.you?.name)
      .map((view) => [view.you.name, view.you.hand || []])
  );

  return {
    ...snapshot,
    others: players.map((player) => ({
      ...player,
      hand: hands.get(player.name) || [],
    })),
  };
}

function readStoredMatchConfig(matchId, snapshot) {
  // La última configuración global puede pertenecer a otra partida que haya
  // reutilizado los mismos nombres. Sólo la clave ligada al match es evidencia
  // válida para completar snapshots de backends antiguos.
  const candidates = [localStorage.getItem(matchConfigKey(matchId))];
  const snapshotNames = (snapshot.teams || [])
    .flatMap((team) => team.players || [])
    .sort();

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const config = JSON.parse(raw);
      const configNames = (config.players || []).map((player) => player.name).sort();
      if (configNames.length === snapshotNames.length
          && configNames.every((name, index) => name === snapshotNames[index])) {
        return config;
      }
    } catch {
      // Configuración antigua o corrupta: se ignora y se usa el snapshot.
    }
  }
  return null;
}

function enrichLLMMetadata(snapshot, matchId) {
  const config = readStoredMatchConfig(matchId, snapshot);
  if (!config) return snapshot;
  const agents = new Map(
    (config.players || [])
      .filter((player) => player.kind === "agent")
      .map((player) => [player.name, {
        provider: player.provider,
        model: player.model || null,
        bluff_level: player.bluff_level || player.bluffLevel || "equilibrado",
        bluff_scope: config.bluff_scope || "player",
      }])
  );
  const enrichPlayer = (player) => player
    ? { ...player, agent: player.agent || agents.get(player.name) }
    : player;
  const engineConfig = snapshot.engine_config || (
    config.engine === "llm"
      ? {
          kind: "llm",
          provider: config.engine_provider,
          model: config.engine_model || null,
        }
      : { kind: "deterministic" }
  );

  return {
    ...snapshot,
    engine_config: engineConfig,
    you: enrichPlayer(snapshot.you),
    others: (snapshot.others || []).map(enrichPlayer),
  };
}

export default function Mesa({ matchId }) {
  const [state, setState] = useState(null);
  const [spectator] = useState(
    () => localStorage.getItem(spectatorKey(matchId)) === "1"
  );
  const [seat, setSeat] = useState(
    () => localStorage.getItem(seatKey(matchId)) || ""
  );

  const refresh = useCallback(async () => {
    const s = spectator
      ? await getSpectatorState(matchId)
      : await getState(matchId, seat || undefined);
    setState(enrichLLMMetadata(s, matchId));
  }, [matchId, seat, spectator]);

  const error = usePolling(refresh, 1000, [matchId, seat, spectator]);

  if (error) {
    return (
      <main className="mesa mesa-bg flex min-h-screen items-center justify-center">
        <p
          className="err inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 text-crema"
          data-testid="conn-error"
          role="status"
        >
          <Spinner testId="retry-wait-spinner" />
          Sin conexión con la mesa ({error.message}). Reintentando…
        </p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="mesa mesa-bg flex min-h-screen items-center justify-center">
        <p className="inline-flex items-center gap-3 text-crema" role="status">
          <Spinner size="md" testId="opening-wait-spinner" />
          Abriendo la mesa…
        </p>
      </main>
    );
  }

  if (!seat && !spectator) {
    return (
      <SeatPicker matchId={matchId} state={state} onPick={setSeat} />
    );
  }

  return <Table state={state} matchId={matchId} seat={spectator ? null : seat} />;
}

function SeatPicker({ matchId, state, onPick }) {
  const seats = state.teams.flatMap((t) =>
    t.players.map((p) => ({
      name: p,
      team: teamDisplayName(t),
      collective: t.players.length > 1,
    }))
  );
  function pick(name) {
    localStorage.setItem(seatKey(matchId), name);
    onPick(name);
  }
  return (
    <main
      className="lobby mx-auto min-h-screen max-w-lg px-4 py-16 sm:py-24"
      data-testid="seat-picker"
    >
      <h1 className="text-center font-serif-display text-3xl font-bold text-crema
                      drop-shadow-md">
        Elegí tu asiento
      </h1>
      <p className="sub mb-8 text-center text-sm text-crema/55">
        Partida {matchId}
      </p>
      <section className="panel glass-panel rounded-2xl p-6 shadow-2xl shadow-black/40">
        {seats.map((s) => (
          <button
            type="button"
            key={s.name}
            data-testid={`seat-choice-${s.name}`}
            className="seat-btn glass-panel mb-2 block w-full rounded-lg px-3 py-2.5
                       text-left text-crema transition hover:border-teal/40!"
            onClick={() => pick(s.name)}
          >
            🪑 {s.name}{" "}
            {s.collective && <small className="text-crema/50">({s.team})</small>}
          </button>
        ))}
      </section>
    </main>
  );
}
