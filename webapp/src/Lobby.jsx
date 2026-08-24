import React, { useState } from "react";
import { createMatch } from "./api.js";

const DEFAULT_NAMES = {
  "1v1": ["Jugador 1", "Jugador 2"],
  "2v2": ["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"],
};

export const LLM_PROVIDERS = ["mock", "claude", "codex", "opencode", "ollama"];

const SEG_BTN = "seg-btn flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 " +
  "font-serif-display text-sm text-tinta shadow-sm transition hover:border-pano " +
  "hover:shadow";
const SEG_BTN_ON = SEG_BTN + " on bg-pano! text-white! border-pano! shadow-md";
const INPUT = "block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 " +
  "text-sm text-tinta shadow-sm outline-none transition focus:border-pano " +
  "focus:ring-2 focus:ring-pano/30";

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
  const [stepMode, setStepMode] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState(null);

  const allAgents = seats.every((s) => s.kind === "agent");

  function pickMode(m) {
    setMode(m);
    setSeats(defaultSeats(m));
    setStepMode(false);
  }

  function updateSeat(i, patch) {
    const next = seats.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setSeats(next);
    if (!next.every((s) => s.kind === "agent")) setStepMode(false);
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
        step_mode: allAgents && stepMode,
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
    <main
      className="lobby mx-auto min-h-screen max-w-lg px-4 py-16 sm:py-24"
      data-testid="lobby"
    >
      <h1 className="text-center font-serif-display text-3xl font-bold text-crema
                      drop-shadow-md">
        🃏 Truco Argentino
      </h1>
      <p className="sub mb-8 text-center text-sm text-stone-300">
        La mesa virtual, como en el club.
      </p>

      <section className="panel mb-6 rounded-2xl bg-crema p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-4 text-lg font-bold text-tinta">Nueva partida</h2>

        <div className="field mb-5">
          <span className="label mb-1.5 block text-xs font-semibold uppercase
                            tracking-wider text-tinta/65">
            Modalidad
          </span>
          <div className="seg flex gap-2">
            {["1v1", "2v2"].map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`mode-${m}`}
                className={m === mode ? SEG_BTN_ON : SEG_BTN}
                onClick={() => pickMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="field mb-5">
          <span className="label mb-1.5 block text-xs font-semibold uppercase
                            tracking-wider text-tinta/65">
            Partida a
          </span>
          <div className="seg flex gap-2">
            {[15, 30].map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`target-${t}`}
                className={t === target ? SEG_BTN_ON : SEG_BTN}
                onClick={() => setTarget(t)}
              >
                {t} puntos
              </button>
            ))}
          </div>
        </div>

        <div className="field mb-5">
          <span className="label mb-1.5 block text-xs font-semibold uppercase
                            tracking-wider text-tinta/65">
            Motor de reglas
          </span>
          <div className="seg flex gap-2">
            {["llm", "deterministic"].map((e) => (
              <button
                key={e}
                type="button"
                data-testid={`engine-${e}`}
                className={e === engine ? SEG_BTN_ON : SEG_BTN}
                onClick={() => setEngine(e)}
              >
                {e === "llm" ? "LLM" : "Determinista"}
              </button>
            ))}
          </div>
          {engine === "llm" && (
            <div
              className="engine-config mt-2 flex gap-2"
              data-testid="engine-config"
            >
              <select
                data-testid="engine-provider"
                value={engineProvider}
                onChange={(e) => setEngineProvider(e.target.value)}
                className={INPUT + " flex-1"}
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
                className={INPUT + " flex-1"}
              />
            </div>
          )}
        </div>

        <div className="field mb-5">
          <span className="label mb-1.5 block text-xs font-semibold uppercase
                            tracking-wider text-tinta/65">
            Asientos
          </span>
          {seats.map((s, i) => (
            <div
              className="seat-config mb-2 rounded-lg border border-stone-300 p-3"
              key={i}
              data-testid={`seat-config-${i}`}
            >
              <input
                data-testid={`seat-${i}`}
                value={s.name}
                onChange={(e) => updateSeat(i, { name: e.target.value })}
                placeholder={`Asiento ${i + 1}`}
                className={INPUT + " mb-2"}
              />
              <div className="seg small flex gap-2">
                {["web", "agent"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`seat-${i}-kind-${k}`}
                    className={
                      (k === s.kind ? SEG_BTN_ON : SEG_BTN) + " py-1.5! text-xs!"
                    }
                    onClick={() => updateSeat(i, { kind: k })}
                  >
                    {k === "web" ? "Humano" : "Agente LLM"}
                  </button>
                ))}
              </div>
              {s.kind === "agent" && (
                <div
                  className="engine-config mt-2 flex gap-2"
                  data-testid={`seat-${i}-agent-config`}
                >
                  <select
                    data-testid={`seat-${i}-provider`}
                    value={s.provider}
                    onChange={(e) => updateSeat(i, { provider: e.target.value })}
                    className={INPUT + " flex-1"}
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
                    className={INPUT + " flex-1"}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="field mb-5">
          <label
            className={
              "flex items-center gap-2 text-sm " +
              (allAgents ? "cursor-pointer text-tinta" : "cursor-not-allowed text-tinta/40")
            }
            data-testid="step-mode-label"
          >
            <input
              type="checkbox"
              data-testid="step-mode"
              checked={stepMode && allAgents}
              disabled={!allAgents}
              onChange={(e) => setStepMode(e.target.checked)}
            />
            Modo paso a paso (espectador) — controlá el ritmo de la partida
          </label>
          {!allAgents && (
            <p className="mt-1 text-xs text-tinta/50">
              Disponible solo cuando todos los asientos son Agente LLM.
            </p>
          )}
        </div>

        <button
          type="button"
          className="primary w-full rounded-xl bg-pano py-3 font-bold text-white
                     shadow-md transition hover:brightness-110 active:scale-[0.99]"
          data-testid="crear"
          onClick={crear}
        >
          Repartir y jugar
        </button>
        {error && <p className="err mt-3 text-sm text-rojo">{error}</p>}
      </section>

      <section className="panel rounded-2xl bg-crema p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-4 text-lg font-bold text-tinta">Unirse a una partida</h2>
        <div className="join flex gap-2">
          <input
            data-testid="join-input"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="match_id o link de invitación"
            className={INPUT + " flex-1"}
          />
          <button
            type="button"
            data-testid="join"
            onClick={unirse}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2
                       text-sm font-semibold text-tinta shadow-sm transition
                       hover:border-pano hover:shadow"
          >
            Entrar
          </button>
        </div>
      </section>
    </main>
  );
}
