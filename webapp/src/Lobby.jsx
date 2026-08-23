import React, { useState } from "react";
import { createMatch } from "./api.js";

const DEFAULTS = {
  "1v1": ["Jugador 1", "Jugador 2"],
  "2v2": ["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"],
};

export default function Lobby({ onCreated }) {
  const [mode, setMode] = useState("1v1");
  const [target, setTarget] = useState(15);
  const [names, setNames] = useState(DEFAULTS["1v1"]);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  function pickMode(m) {
    setMode(m);
    setNames(DEFAULTS[m]);
  }

  function setName(i, value) {
    setNames(names.map((n, j) => (j === i ? value : n)));
  }

  async function crear() {
    setError(null);
    try {
      const data = await createMatch({
        mode,
        target_score: target,
        players: names.map((name) => ({ name: name || undefined })),
        seed: null,
      });
      localStorage.setItem(
        `truco:lastConfig`,
        JSON.stringify({ mode, target_score: target, players: names })
      );
      setCreated(data.match_id);
      onCreated?.(data.match_id);
    } catch (e) {
      setError(e.message);
    }
  }

  function unirse() {
    const raw = joinId.trim();
    if (!raw) return;
    const id = raw.includes("match=")
      ? new URL(raw, window.location.origin).searchParams.get("match")
      : raw;
    if (id) {
      window.history.pushState({}, "", `/mesa?match=${id}`);
      onCreated?.(id);
    }
  }

  return (
    <main className="lobby" data-testid="lobby">
      <h1>🃏 Truco Argentino</h1>
      <p className="sub">La mesa virtual, como en el club.</p>

      <section className="panel">
        <h2>Nueva partida</h2>

        <div className="field">
          <span className="label">Modalidad</span>
          <div className="seg">
            {["1v1", "2v2"].map((m) => (
              <button
                key={m}
                data-testid={`mode-${m}`}
                className={m === mode ? "seg-btn on" : "seg-btn"}
                onClick={() => pickMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Partida a</span>
          <div className="seg">
            {[15, 30].map((t) => (
              <button
                key={t}
                data-testid={`target-${t}`}
                className={t === target ? "seg-btn on" : "seg-btn"}
                onClick={() => setTarget(t)}
              >
                {t} puntos
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Asientos</span>
          {names.map((n, i) => (
            <input
              key={i}
              data-testid={`seat-${i}`}
              value={n}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={`Asiento ${i + 1}`}
            />
          ))}
        </div>

        <button className="primary" data-testid="crear" onClick={crear}>
          Repartir y jugar
        </button>
        {error && <p className="err">{error}</p>}
      </section>

      <section className="panel">
        <h2>Unirse a una partida</h2>
        <div className="join">
          <input
            data-testid="join-input"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="match_id o link de invitación"
          />
          <button data-testid="join" onClick={unirse}>
            Entrar
          </button>
        </div>
      </section>
    </main>
  );
}
