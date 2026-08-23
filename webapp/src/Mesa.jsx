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
      <main className="mesa">
        <p className="err" data-testid="conn-error">
          Sin conexión con la mesa ({error.message}). Reintentando…
        </p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="mesa">
        <p>Abriendo la mesa…</p>
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
    <main className="lobby" data-testid="seat-picker">
      <h1>Elegí tu asiento</h1>
      <p className="sub">Partida {matchId}</p>
      <section className="panel">
        {seats.map((s) => (
          <button
            key={s.name}
            data-testid={`seat-choice-${s.name}`}
            className="seat-btn"
            onClick={() => pick(s.name)}
          >
            🪑 {s.name} <small>({s.team})</small>
          </button>
        ))}
      </section>
    </main>
  );
}
