import React, { useState } from "react";
import { createMatch } from "./api.js";

const DEFAULT_NAMES = {
  "1v1": ["Jugador 1", "Jugador 2"],
  "2v2": ["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"],
};

export const LLM_PROVIDERS = ["mock", "claude", "codex", "opencode", "ollama"];

function defaultSeat(name) {
  return { name, kind: "web", provider: "mock", model: "" };
}

function defaultSeats(mode) {
  return DEFAULT_NAMES[mode].map(defaultSeat);
}

export default function Lobby({ onCreated }) {
  const [mode, setMode] = useState("1v1");
  const [target, setTarget] = useState(15);
  const [seats, setSeats] = useState(defaultSeats("1v1"));
  const [engine, setEngine] = useState("llm");
  const [engineProvider, setEngineProvider] = useState("mock");
  const [engineModel, setEngineModel] = useState("");
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState(null);

  function pickMode(m) {
    setMode(m);
    setSeats(defaultSeats(m));
  }

  function updateSeat(i, patch) {
    setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function crear() {
    setError(null);
    try {
      const players = seats.map((s) => ({
        name: s.name || undefined,
        kind: s.kind,
        ...(s.kind === "agent"
          ? { provider: s.provider, model: s.model || undefined }
          : {}),
      }));
      const data = await createMatch({
        mode,
        target_score: target,
        players,
        engine,
        engine_provider: engineProvider,
        engine_model: engineModel || undefined,
        seed: null,
      });
      localStorage.setItem(
        "truco:lastConfig",
        JSON.stringify({
          mode, target_score: target, players: seats,
          engine, engine_provider: engineProvider, engine_model: engineModel,
        })
      );
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
          <span className="label">Motor de reglas</span>
          <div className="seg">
            {["llm", "deterministic"].map((e) => (
              <button
                key={e}
                data-testid={`engine-${e}`}
                className={e === engine ? "seg-btn on" : "seg-btn"}
                onClick={() => setEngine(e)}
              >
                {e === "llm" ? "LLM" : "Determinista"}
              </button>
            ))}
          </div>
          {engine === "llm" && (
            <div className="engine-config" data-testid="engine-config">
              <select
                data-testid="engine-provider"
                value={engineProvider}
                onChange={(e) => setEngineProvider(e.target.value)}
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                data-testid="engine-model"
                value={engineModel}
                onChange={(e) => setEngineModel(e.target.value)}
                placeholder="modelo (opcional)"
              />
            </div>
          )}
        </div>

        <div className="field">
          <span className="label">Asientos</span>
          {seats.map((s, i) => (
            <div className="seat-config" key={i} data-testid={`seat-config-${i}`}>
              <input
                data-testid={`seat-${i}`}
                value={s.name}
                onChange={(e) => updateSeat(i, { name: e.target.value })}
                placeholder={`Asiento ${i + 1}`}
              />
              <div className="seg small">
                {["web", "agent"].map((k) => (
                  <button
                    key={k}
                    data-testid={`seat-${i}-kind-${k}`}
                    className={k === s.kind ? "seg-btn on" : "seg-btn"}
                    onClick={() => updateSeat(i, { kind: k })}
                  >
                    {k === "web" ? "Humano" : "Agente LLM"}
                  </button>
                ))}
              </div>
              {s.kind === "agent" && (
                <div className="engine-config" data-testid={`seat-${i}-agent-config`}>
                  <select
                    data-testid={`seat-${i}-provider`}
                    value={s.provider}
                    onChange={(e) => updateSeat(i, { provider: e.target.value })}
                  >
                    {LLM_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    data-testid={`seat-${i}-model`}
                    value={s.model}
                    onChange={(e) => updateSeat(i, { model: e.target.value })}
                    placeholder="modelo (opcional)"
                  />
                </div>
              )}
            </div>
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
