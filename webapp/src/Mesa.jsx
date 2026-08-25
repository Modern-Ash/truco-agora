import React, { useCallback, useState } from "react";
import { getState } from "./api.js";
import { usePolling } from "./hooks.js";
import Table from "./components/Table.jsx";

export function seatKey(matchId) {
  return `truco:seat:${matchId}`;
}

export default function Mesa({ matchId }) {
  const [state, setState] = useState(null);
  const [seat, setSeat] = useState(
    () => localStorage.getItem(seatKey(matchId)) || ""
  );

  const refresh = useCallback(async () => {
    const s = await getState(matchId, seat || undefined);
    setState(s);
  }, [matchId, seat]);

  const error = usePolling(refresh, 1000, [matchId, seat]);

  if (error) {
    return (
      <main className="mesa mesa-bg flex min-h-screen items-center justify-center">
        <p
          className="err rounded-full bg-black/30 px-4 py-2 text-crema"
          data-testid="conn-error"
        >
          Sin conexión con la mesa ({error.message}). Reintentando…
        </p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="mesa mesa-bg flex min-h-screen items-center justify-center">
        <p className="text-crema">Abriendo la mesa…</p>
      </main>
    );
  }

  if (!seat) {
    return (
      <SeatPicker matchId={matchId} state={state} onPick={setSeat} />
    );
  }

  return <Table state={state} matchId={matchId} seat={seat} />;
}

function SeatPicker({ matchId, state, onPick }) {
  const seats = state.teams.flatMap((t) =>
    t.players.map((p) => ({ name: p, team: t.name }))
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
            🪑 {s.name} <small className="text-crema/50">({s.team})</small>
          </button>
        ))}
      </section>
    </main>
  );
}
