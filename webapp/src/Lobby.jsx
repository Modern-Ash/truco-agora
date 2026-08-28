import React, { useEffect, useState } from "react";
import { createMatch, getLLMModels } from "./api.js";
import { NOMBRES_EQUIPOS, pickUnique, pickName, poolFor } from "./names.js";
import { matchConfigKey, spectatorKey } from "./matchStorage.js";
import SpanishCard from "./components/SpanishCard.jsx";
import ModelPicker from "./components/ModelPicker.jsx";

export const LLM_PROVIDERS = ["codex", "claude", "opencode", "ollama"];
export const DEFAULT_LLM_PROVIDER = "codex";
// Nivel de faroleo del agente LLM (truco/controller.py: LLMController.BLUFF_LEVELS).
export const BLUFF_LEVELS = [
  { value: "cauteloso", label: "Cauteloso" },
  { value: "equilibrado", label: "Equilibrado" },
  { value: "mentiroso", label: "Mentiroso" },
];

function bluffLabel(value) {
  return BLUFF_LEVELS.find((level) => level.value === value)?.label || value;
}

const SEG_BTN = "lobby-choice";
const SEG_BTN_ON = `${SEG_BTN} on`;
const INPUT = "lobby-input";

function defaultSeats(mode) {
  const count = mode === "2v2" ? 4 : 2;
  const seats = [];
  for (let i = 0; i < count; i++) {
    const excluded = seats.map((s) => s.name);
    seats.push({
      name: pickName(poolFor("web"), excluded),
      kind: "web",
      provider: DEFAULT_LLM_PROVIDER,
      model: "",
      bluffLevel: "equilibrado",
      autoName: true, // el nombre sigue siendo un default: se regenera al cambiar de tipo
    });
  }
  return seats;
}

export default function Lobby({ onCreated }) {
  const [mode, setMode] = useState("1v1");
  const [target, setTarget] = useState(15);
  const [seats, setSeats] = useState(defaultSeats("1v1"));
  const [engine, setEngine] = useState("llm");
  const [engineProvider, setEngineProvider] = useState(DEFAULT_LLM_PROVIDER);
  const [engineModel, setEngineModel] = useState("");
  const [florEnabled, setFlorEnabled] = useState(false);
  const [bluffScope, setBluffScope] = useState("player");
  const [teamBluffLevels, setTeamBluffLevels] = useState([
    "equilibrado", "equilibrado",
  ]);
  const [stepMode, setStepMode] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState(null);
  const [providerCatalogs, setProviderCatalogs] = useState({});

  const allAgents = seats.every((s) => s.kind === "agent");

  useEffect(() => {
    let active = true;
    for (const provider of LLM_PROVIDERS) {
      getLLMModels(provider)
        .then((catalog) => {
          if (active) {
            setProviderCatalogs((current) => ({ ...current, [provider]: catalog }));
          }
        })
        .catch((reason) => {
          if (active) {
            setProviderCatalogs((current) => ({
              ...current,
              [provider]: {
                provider,
                available: false,
                models: [],
                message: reason.message || "No se pudo verificar el proveedor.",
              },
            }));
          }
        });
    }
    return () => { active = false; };
  }, []);

  function pickMode(m) {
    setMode(m);
    setSeats(defaultSeats(m));
    setBluffScope("player");
    setTeamBluffLevels(["equilibrado", "equilibrado"]);
    setStepMode(false);
  }

  function updateSeat(i, patch) {
    const next = seats.map((s, j) => {
      if (j !== i) return s;
      if ("name" in patch) return { ...s, ...patch, autoName: false };
      if ("kind" in patch && patch.kind !== s.kind && s.autoName) {
        const excluded = seats.filter((_, k) => k !== i).map((x) => x.name);
        return { ...s, ...patch, name: pickName(poolFor(patch.kind), excluded) };
      }
      return { ...s, ...patch };
    });
    setSeats(next);
    const nextAllAgents = next.every((s) => s.kind === "agent");
    if (!allAgents && nextAllAgents) setStepMode(true);
    else if (!nextAllAgents) setStepMode(false);
  }

  async function crear() {
    setError(null);
    try {
      const ollamaAssignments = [
        ...(engine === "llm" && engineProvider === "ollama"
          ? [{ label: "Motor de reglas", model: engineModel }]
          : []),
        ...seats
          .filter((seat) => seat.kind === "agent" && seat.provider === "ollama")
          .map((seat) => ({ label: seat.name, model: seat.model })),
      ];
      if (ollamaAssignments.length) {
        const catalog = providerCatalogs.ollama || await getLLMModels("ollama");
        const installed = catalog.models || [];
        if (!catalog.available || installed.length === 0) {
          throw new Error("Ollama no está disponible o no tiene modelos instalados.");
        }
        const invalid = ollamaAssignments.find(
          ({ model }) => !model || !installed.includes(model)
        );
        if (invalid) {
          throw new Error(`${invalid.label}: elegí un modelo instalado de Ollama.`);
        }
      }
      const teamPicardia = mode === "2v2" && bluffScope === "team";
      const resolvedSeats = seats.map((seat, index) => ({
        ...seat,
        bluffLevel: teamPicardia
          ? teamBluffLevels[index % 2]
          : seat.bluffLevel,
      }));
      const players = resolvedSeats.map((s) => ({
        name: s.name || undefined,
        kind: s.kind,
        ...(s.kind === "agent"
          ? {
              provider: s.provider,
              model: s.model || undefined,
              ...(!teamPicardia ? { bluff_level: s.bluffLevel } : {}),
            }
          : {}),
      }));
      // En 1v1 no hay una colectividad separada del jugador: el backend usa
      // directamente los dos nombres de asiento. Los nombres de equipos se
      // generan únicamente para 2v2.
      const team_names = mode === "2v2"
        ? pickUnique(NOMBRES_EQUIPOS, 2)
        : undefined;
      const data = await createMatch({
        mode,
        target_score: target,
        players,
        engine,
        engine_provider: engineProvider,
        engine_model: engineModel || undefined,
        step_mode: allAgents && stepMode,
        seed: null,
        team_names,
        ...(teamPicardia ? { team_bluff_levels: teamBluffLevels } : {}),
        flor_enabled: florEnabled,
      });
      const storedConfig = {
        mode, target_score: target, players: resolvedSeats,
        engine, engine_provider: engineProvider, engine_model: engineModel,
        bluff_scope: teamPicardia ? "team" : "player",
        team_bluff_levels: teamPicardia ? teamBluffLevels : undefined,
        flor_enabled: florEnabled,
      };
      localStorage.setItem("truco:lastConfig", JSON.stringify(storedConfig));
      localStorage.setItem(matchConfigKey(data.match_id), JSON.stringify(storedConfig));
      if (allAgents) {
        localStorage.setItem(spectatorKey(data.match_id), "1");
      }
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
    <main className="lobby-shell" data-testid="lobby">
      <div className="lobby-wrap">
        <header className="lobby-hero">
          <div className="lobby-hero__cards" aria-hidden="true">
            <SpanishCard card={{ numero: 1, palo: "espada" }} size="hero" />
            <SpanishCard card={{ numero: 7, palo: "oro" }} size="hero" />
            <SpanishCard card={{ numero: 3, palo: "copa" }} size="hero" />
          </div>
          <p className="lobby-kicker">Mesa criolla · baraja española</p>
          <h1>Truco Argentino</h1>
          <p>Armá la partida, elegí la variante y que hable el paño.</p>
        </header>

        <div className="lobby-layout">
          <section className="lobby-panel lobby-panel--primary">
            <div className="lobby-panel__title">
              <span>01</span>
              <div><h2>Nueva partida</h2><p>Configurá tu mesa</p></div>
            </div>

            <div className="lobby-options-grid">
              <OptionGroup label="Modalidad">
                {["1v1", "2v2"].map((m) => (
                  <button key={m} type="button" data-testid={`mode-${m}`}
                    className={m === mode ? SEG_BTN_ON : SEG_BTN}
                    onClick={() => pickMode(m)}>{m}</button>
                ))}
              </OptionGroup>
              <OptionGroup label="Partida a">
                {[15, 30].map((t) => (
                  <button key={t} type="button" data-testid={`target-${t}`}
                    className={t === target ? SEG_BTN_ON : SEG_BTN}
                    onClick={() => setTarget(t)}>{t} puntos</button>
                ))}
              </OptionGroup>
              <OptionGroup label="Variante">
                <button type="button" data-testid="flor-off"
                  className={!florEnabled ? SEG_BTN_ON : SEG_BTN}
                  onClick={() => setFlorEnabled(false)}>Sin flor</button>
                <button type="button" data-testid="flor-on"
                  className={florEnabled ? SEG_BTN_ON : SEG_BTN}
                  onClick={() => setFlorEnabled(true)}>Con flor</button>
              </OptionGroup>
              <OptionGroup label="Motor de reglas">
                {["llm", "deterministic"].map((value) => (
                  <button key={value} type="button" data-testid={`engine-${value}`}
                    className={value === engine ? SEG_BTN_ON : SEG_BTN}
                    onClick={() => setEngine(value)}>
                    {value === "llm" ? "LLM" : "Determinista"}
                  </button>
                ))}
              </OptionGroup>
            </div>

            {engine === "llm" && (
              <div className="lobby-inline-config" data-testid="engine-config">
                <select data-testid="engine-provider" value={engineProvider}
                  onChange={(e) => {
                    setEngineProvider(e.target.value);
                    setEngineModel("");
                  }} className={INPUT}>
                  <ProviderOptions catalogs={providerCatalogs} />
                </select>
                <ModelPicker
                  provider={engineProvider}
                  value={engineModel}
                  onChange={setEngineModel}
                  testid="engine-model"
                  catalog={providerCatalogs[engineProvider] || null}
                />
              </div>
            )}

            <div className="lobby-seats">
              <p className="lobby-label">Asientos</p>
              {mode === "2v2" && (
                <section className="picardia-config" data-testid="picardia-config">
                  <div className="picardia-config__heading">
                    <div>
                      <strong>Picardía de los agentes</strong>
                      <small>Definila asiento por asiento o como identidad compartida.</small>
                    </div>
                    <div className="lobby-segment lobby-segment--small" role="group"
                      aria-label="Alcance de la picardía">
                      <button type="button" data-testid="picardia-scope-player"
                        aria-pressed={bluffScope === "player"}
                        className={bluffScope === "player" ? SEG_BTN_ON : SEG_BTN}
                        onClick={() => setBluffScope("player")}>Por jugador</button>
                      <button type="button" data-testid="picardia-scope-team"
                        aria-pressed={bluffScope === "team"}
                        className={bluffScope === "team" ? SEG_BTN_ON : SEG_BTN}
                        onClick={() => setBluffScope("team")}>Por equipo</button>
                    </div>
                  </div>
                  {bluffScope === "team" && (
                    <div className="picardia-team-grid" data-testid="team-bluff-levels">
                      {teamBluffLevels.map((level, teamIndex) => (
                        <fieldset className="picardia-team" key={teamIndex}>
                          <legend>
                            Equipo {teamIndex + 1}
                            <span>Asientos {teamIndex + 1} · {teamIndex + 3}</span>
                          </legend>
                          <BluffLevelButtons
                            value={level}
                            testid={`team-${teamIndex}`}
                            onChange={(nextLevel) => setTeamBluffLevels((current) =>
                              current.map((item, index) =>
                                index === teamIndex ? nextLevel : item
                              )
                            )}
                          />
                        </fieldset>
                      ))}
                    </div>
                  )}
                </section>
              )}
              <div className={`lobby-seats__grid lobby-seats__grid--${mode}`}>
                {seats.map((seat, index) => (
                  <article className="seat-config" key={index}
                    data-testid={`seat-config-${index}`}>
                    <span className="seat-config__number">{String(index + 1).padStart(2, "0")}</span>
                    <input data-testid={`seat-${index}`} value={seat.name}
                      onChange={(e) => updateSeat(index, { name: e.target.value })}
                      placeholder={`Asiento ${index + 1}`} className={INPUT} />
                    <div className="lobby-segment lobby-segment--small">
                      {["web", "agent"].map((kind) => (
                        <button key={kind} type="button"
                          data-testid={`seat-${index}-kind-${kind}`}
                          className={kind === seat.kind ? SEG_BTN_ON : SEG_BTN}
                          onClick={() => updateSeat(index, { kind })}>
                          {kind === "web" ? "Humano" : "Agente LLM"}
                        </button>
                      ))}
                    </div>
                    {seat.kind === "agent" && (
                      <div className="lobby-inline-config" data-testid={`seat-${index}-agent-config`}>
                        <select data-testid={`seat-${index}-provider`} value={seat.provider}
                          onChange={(e) => updateSeat(index, {
                            provider: e.target.value,
                            model: "",
                          })}
                          className={INPUT}>
                          <ProviderOptions catalogs={providerCatalogs} />
                        </select>
                        <ModelPicker
                          provider={seat.provider}
                          value={seat.model}
                          onChange={(model) => updateSeat(index, { model })}
                          testid={`seat-${index}-model`}
                          catalog={providerCatalogs[seat.provider] || null}
                        />
                        {mode !== "2v2" || bluffScope === "player" ? (
                          <BluffLevelButtons
                            value={seat.bluffLevel}
                            testid={`seat-${index}`}
                            onChange={(value) => updateSeat(index, { bluffLevel: value })}
                          />
                        ) : (
                          <p className="picardia-inherited"
                            data-testid={`seat-${index}-bluff-inherited`}>
                            <span>Picardía de equipo</span>
                            <strong>{bluffLabel(teamBluffLevels[index % 2])}</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <label className={`lobby-check ${allAgents ? "" : "is-disabled"}`}
              data-testid="step-mode-label">
              <input type="checkbox" data-testid="step-mode"
                checked={stepMode && allAgents} disabled={!allAgents}
                onChange={(e) => setStepMode(e.target.checked)} />
              <span><b>Ritmo de espectador</b><small>
                {allAgents
                  ? "Autoplay con demora configurable o avance manual."
                  : "Se habilita cuando todos los asientos son agentes."}
              </small></span>
            </label>

            <button type="button" className="lobby-submit" data-testid="crear" onClick={crear}>
              <span>Repartir y jugar</span><b>→</b>
            </button>
            {error && <p className="lobby-error">{error}</p>}
          </section>

          <aside className="lobby-aside">
            <section className="lobby-panel lobby-panel--join">
              <div className="lobby-panel__title">
                <span>02</span><div><h2>Entrar a una mesa</h2><p>Con código o invitación</p></div>
              </div>
              <div className="lobby-join">
                <input data-testid="join-input" value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="match_id o link" className={INPUT} />
                <button type="button" data-testid="join" onClick={unirse}>Entrar</button>
              </div>
            </section>
            <section className="lobby-rules-note">
              <p>Regla de la casa</p>
              <h2>Treinta son las buenas.</h2>
              <ul>
                <li>Baraja española de 40 cartas</li>
                <li>15 malas + 15 buenas</li>
                <li>Flor configurable por mesa</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function OptionGroup({ label, children }) {
  return (
    <fieldset className="lobby-option-group">
      <legend>{label}</legend>
      <div className="lobby-segment">{children}</div>
    </fieldset>
  );
}

function BluffLevelButtons({ value, onChange, testid }) {
  return (
    <div className="lobby-segment lobby-segment--small picardia-levels"
      data-testid={`${testid}-bluff-level`} role="group"
      aria-label="Nivel de picardía">
      {BLUFF_LEVELS.map((level) => (
        <button key={level.value} type="button"
          data-testid={`${testid}-bluff-${level.value}`}
          title="Qué tan seguido intenta ganar mediante faroles legales"
          aria-pressed={level.value === value}
          className={level.value === value ? SEG_BTN_ON : SEG_BTN}
          onClick={() => onChange(level.value)}>
          {level.label}
        </button>
      ))}
    </div>
  );
}

function ProviderOptions({ catalogs }) {
  return LLM_PROVIDERS.map((provider) => {
    if (provider !== "ollama") {
      return <option key={provider} value={provider}>{provider}</option>;
    }
    const catalog = catalogs[provider];
    const checking = !catalog;
    const noOllamaModels = catalog?.available
      && (catalog.models || []).length === 0;
    const disabled = checking || !catalog?.available || noOllamaModels;
    const suffix = checking
      ? " · comprobando"
      : disabled ? " · no disponible" : "";
    return (
      <option key={provider} value={provider} disabled={disabled}>
        {provider}{suffix}
      </option>
    );
  });
}
