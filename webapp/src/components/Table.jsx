import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Hand from "./Hand.jsx";
import Actions from "./Actions.jsx";
import Scoreboard from "./Scoreboard.jsx";
import Spinner from "./Spinner.jsx";
import { createMatch, getState, postAction, postSena, postStep } from "../api.js";
import SpanishCard, { CardBack } from "./SpanishCard.jsx";
import { teamDisplayName, winnerDisplayName } from "../teamNames.js";
import { playTableSound } from "../tableAudio.js";

const SENAS = ["guiño", "lengua", "ceja", "beso", "suspiro"];

const STEP_KIND_LABEL = {
  action: "elegir una acción",
  card: "jugar una carta",
  response: "responder un canto",
};

const AUTOPLAY_DELAYS = [
  { ms: 1000, label: "1s" },
  { ms: 2000, label: "2s" },
  { ms: 4000, label: "4s" },
];

// Elegir acción/responder un canto son pasos internos sin cambio visible en
// la baza. Se procesan rápido; el delay configurado se reserva para la carta,
// que es la cadencia que el espectador realmente percibe como una jugada.
const INTERNAL_AUTOPLAY_DELAY_MS = 200;
const TABLE_SOUND_KEY = "truco:table-sound";

const PROVIDER_LABELS = {
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode",
  ollama: "Ollama",
  mock: "Mock",
};

const BLUFF_LABELS = {
  cauteloso: "Cauteloso",
  equilibrado: "Equilibrado",
  mentiroso: "Mentiroso",
};

const CALL_LABELS = {
  envido: "Envido",
  real_envido: "Real Envido",
  falta_envido: "Falta Envido",
  truco: "Truco",
  retruco: "Retruco",
  vale_cuatro: "Vale Cuatro",
  flor: "Flor",
  contraflor: "Contraflor",
  contraflor_al_resto: "Contraflor al resto",
};

const CALL_RESPONSE_LABELS = {
  quiero: "Quiero",
  no_quiero: "No quiero",
  con_flor_quiero: "Con flor quiero",
  con_flor_me_achico: "Con flor me achico",
};

const FALLBACK_REASON_LABELS = {
  "provider-timeout": "El proveedor excedió el tiempo de espera",
  "provider-unavailable": "El proveedor no estaba disponible",
  "provider-exit": "El proveedor terminó con error",
  "repair-failed": "No se pudo normalizar la respuesta del proveedor",
  "invalid-response": "El proveedor no devolvió una opción válida",
  "provider-error": "El proveedor no pudo completar la decisión",
};

const CHAT_TONES = ["teal", "violet", "gold", "coral"];

function llmIdentity(config) {
  if (!config?.provider) return null;
  const provider = PROVIDER_LABELS[config.provider] || config.provider;
  return config.model ? `${provider} · ${config.model}` : provider;
}

function preserveEngineConfig(previous, next) {
  if (!next) return next;
  const merged = next.engine_config != null || !previous?.engine_config
    ? next
    : { ...next, engine_config: previous.engine_config };
  if (!previous || merged.finished) return merged;

  // Durante el hueco entre liberar el gate y publicar el paso siguiente puede
  // llegar un poll sin manos. Si no se jugó ninguna carta, ese vacío no es un
  // estado de juego: preservamos la última mano válida para que la mesa no
  // parpadee ni parezca haber recogido las cartas.
  const transientStep = Boolean(merged.step_mode && !merged.pending_step);
  const previousPlayers = new Map(
    [...(previous.you ? [previous.you] : []), ...(previous.others || [])]
      .map((player) => [player.name, player])
  );
  const preservePlayer = (player) => {
    const before = previousPlayers.get(player?.name);
    if (!player || !before) return player;
    const nextHand = player.hand;
    const beforeHand = before.hand;
    const samePlayed = (player.played || []).length === (before.played || []).length;
    const missingTransientHand = transientStep && Array.isArray(beforeHand)
      && beforeHand.length > 0 && samePlayed
      && (!Array.isArray(nextHand) || nextHand.length === 0);
    return missingTransientHand ? { ...player, hand: beforeHand } : player;
  };

  return {
    ...merged,
    you: preservePlayer(merged.you),
    others: (merged.others || []).length === 0 && transientStep
      ? previous.others
      : (merged.others || []).map(preservePlayer),
  };
}

function latestCallAnnouncement(tableEvents, callVigente, responsePlayer) {
  const callEvents = (tableEvents || []).filter(
    (event) => event.type === "call" || event.type === "call_response"
  );
  const latest = callEvents.at(-1);
  if (callVigente) {
    const matchingCall = [...callEvents].reverse().find(
      (event) => event.type === "call" && event.call === callVigente
    );
    return {
      call: callVigente,
      player: matchingCall?.player || null,
      responder: responsePlayer,
      live: true,
    };
  }
  if (!latest) return null;
  if (latest.type === "call") {
    return {
      call: latest.call,
      player: latest.player,
      responder: null,
      live: false,
    };
  }
  return {
    call: latest.call,
    player: null,
    responder: latest.player,
    response: latest.response,
    live: false,
  };
}

function playerDomKey(name) {
  return encodeURIComponent(name);
}

export default function Table({ state: propState, matchId, seat }) {
  const [state, setState] = useState(propState);
  const [busy, setBusy] = useState(false);
  const [tapada, setTapada] = useState(false);
  const [senaAbierta, setSenaAbierta] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [autoPlay, setAutoPlay] = useState(() => seat == null);
  const [autoDelay, setAutoDelay] = useState(2000);
  const [stepping, setStepping] = useState(false);
  const [stepSource, setStepSource] = useState(null);
  const [dealPhase, setDealPhase] = useState(
    () => propState?.finished || !propState?.mano ? null : "shuffle"
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(TABLE_SOUND_KEY) === "1"
  );
  const [historial, setHistorial] = useState([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const prevRef = useRef(null);
  const stepModeSeenRef = useRef(Boolean(propState?.step_mode || propState?.pending_step));
  const dealtManoRef = useRef(null);
  const steppingRef = useRef(false);

  useEffect(() => {
    setState((current) => preserveEngineConfig(current, propState));
  }, [propState]);

  useEffect(() => {
    if (state.finished || !state.mano) {
      setDealPhase(null);
      return undefined;
    }
    if (dealtManoRef.current === state.mano) return undefined;
    dealtManoRef.current = state.mano;
    setDealPhase("shuffle");
    const dealTimer = setTimeout(() => setDealPhase("deal"), 480);
    const finishTimer = setTimeout(() => setDealPhase(null), 1250);
    return () => {
      clearTimeout(dealTimer);
      clearTimeout(finishTimer);
    };
  }, [state.finished, state.mano]);

  useEffect(() => {
    localStorage.setItem(TABLE_SOUND_KEY, soundEnabled ? "1" : "0");
    if (soundEnabled && dealPhase) {
      playTableSound(dealPhase);
    }
  }, [dealPhase, soundEnabled]);

  // Historial de jugadas: se arma por diff entre polls sucesivos (la API no
  // expone un log de eventos), para poder verificar a ojo que la secuencia
  // de la mano coincide con las reglas oficiales. Se espeja por console.log
  // para inspección fuera de la UI.
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = propState;
    if (!prev || !propState) return;
    const entradas = [];
    const todos = [
      ...(propState.you ? [propState.you] : []),
      ...(propState.others || []),
    ];
    const todosPrev = [
      ...(prev.you ? [prev.you] : []),
      ...(prev.others || []),
    ];
    for (const jugador of todos) {
      const antes = todosPrev.find((p) => p.name === jugador.name);
      const nuevas = (jugador.played || []).length - (antes?.played?.length || 0);
      if (nuevas > 0) {
        const cartas = jugador.played.slice(-nuevas);
        for (const c of cartas) {
          entradas.push(
            c.tapada
              ? `${jugador.name} jugó una carta boca abajo`
              : `${jugador.name} jugó ${c.numero} de ${c.palo}`
          );
        }
      }
    }
    if (propState.call_vigente && propState.call_vigente !== prev.call_vigente) {
      entradas.push(`Se cantó: ${propState.call_vigente}`);
    }
    for (const t of propState.teams || []) {
      const antes = (prev.teams || []).find((p) => p.name === t.name);
      if (antes && t.score !== antes.score) {
        entradas.push(`${teamDisplayName(t)} pasa a ${t.score} puntos`);
      }
    }
    if (propState.winner && propState.winner !== prev.winner) {
      entradas.push(`🏆 Ganó ${winnerDisplayName(propState.teams, propState.winner)}`);
    }
    if (entradas.length) {
      entradas.forEach((e) => console.log("[truco]", e));
      setHistorial((h) => [...h, ...entradas].slice(-80));
    }
  }, [propState]);

  const pendingStep = state.pending_step;
  if (state.step_mode || pendingStep) stepModeSeenRef.current = true;
  const spectatorStepMode = stepModeSeenRef.current;
  const stepGeneration = state.step_generation ??
    `${pendingStep?.player || "none"}:${pendingStep?.kind || "none"}`;

  async function step(source = "manual") {
    if (steppingRef.current) return;
    steppingRef.current = true;
    setStepping(true);
    setStepSource(source);
    try {
      const next = await postStep(matchId, source);
      setState((current) => preserveEngineConfig(current, next));
    } catch (error) {
      setActionError(
        `No se pudo avanzar la jugada: ${error?.message || "error de conexión"}`
      );
      if (source === "autoplay") setAutoPlay(false);
    } finally {
      steppingRef.current = false;
      setStepping(false);
      setStepSource(null);
    }
  }

  // Auto-play (docs/step-mode.md): re-programa el próximo step con el
  // delay elegido, en vez de un setInterval fijo — así respeta el tiempo
  // real que tarda cada agente en decidir (puede variar mucho entre
  // proveedores) en lugar de superponer pedidos.
  useEffect(() => {
    if (!autoPlay || stepping || !pendingStep || state.finished) return;
    const delay = pendingStep.kind === "card"
      ? autoDelay
      : INTERNAL_AUTOPLAY_DELAY_MS;
    const t = setTimeout(() => { step("autoplay"); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, autoDelay, stepGeneration, state.finished, stepping]);

  // Entrega de señas (reglas-v2.md §4): mostrar y auto-ocultar
  useEffect(() => {
    const s = propState?.you?.sena_recibida;
    if (s) {
      setToast(`${s.de} te hizo: ${s.sena}`);
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [propState?.you?.sena_recibida]);

  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(t);
  }, [actionError]);

  const you = state.you;
  const myTurn = Boolean(
    you?.pending && state.turn === seat && !state.finished
  );

  const others = state.others || [];
  const partner =
    you && others.find((o) => o.team === you.team);
  const rivals = others.filter((o) => !you || o.team !== you.team);

  async function send(payload) {
    if (busy) return;
    setBusy(true);
    try {
      await postAction(matchId, { player: seat, ...payload });
      const next = await getState(matchId, seat);
      setState((current) => preserveEngineConfig(current, next));
    } catch (e) {
      // Un error HTTP (e.status) es una respuesta real del backend rechazando
      // la jugada (422/409): se le avisa al usuario. Sin status es un fallo
      // de red transitorio; el polling ya se encarga de reponer el estado.
      if (e.status) setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function playCard(card) {
    if (!myTurn || busy) return;
    send({ action: "play_card", card, tapada });
    setTapada(false); // la jugada boca abajo es por única vez
  }

  async function copiarInvitacion() {
    const link = `${window.location.origin}/mesa?match=${matchId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* portapapeles no disponible: el link igual queda visible abajo */
    }
    setToast("Invitación copiada");
  }

  async function mandarSena(sena) {
    setSenaAbierta(false);
    try {
      await postSena(matchId, { de: seat, para: partner.name, sena });
    } catch {
      /* sin destino válido: ignorar */
    }
  }

  async function revancha() {
    let cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem("truco:lastConfig") || "null");
    } catch {
      /* sin config previa */
    }
    if (cfg) {
      const data = await createMatch({
        mode: cfg.mode,
        target_score: cfg.target_score,
        players: cfg.players.map((player) => ({
          name: player.name,
          kind: player.kind,
          ...(player.kind === "agent"
            ? {
                provider: player.provider,
                model: player.model || undefined,
                ...(cfg.bluff_scope !== "team"
                  ? { bluff_level: player.bluffLevel || player.bluff_level }
                  : {}),
              }
            : {}),
        })),
        engine: cfg.engine,
        engine_provider: cfg.engine_provider,
        engine_model: cfg.engine_model || undefined,
        team_bluff_levels: cfg.bluff_scope === "team"
          ? cfg.team_bluff_levels
          : undefined,
        flor_enabled: cfg.flor_enabled,
        step_mode: cfg.players.every((player) => player.kind === "agent"),
      });
      window.location.href = `/mesa?match=${data.match_id}`;
    }
  }

  return (
    <main
      className="mesa mesa-bg game-screen flex min-h-screen flex-col"
      data-testid="mesa"
    >
      {!state.finished && you && state.turn && (
        <div className="game-shell game-turn-slot" data-testid="turn-status-slot">
          <div
            className={
              "turn-banner game-turn-banner glass-panel flex items-center gap-2 rounded-full " +
              "px-5 py-2 font-serif-display text-sm font-bold shadow-lg shadow-black/30 " +
              (myTurn
                ? "border-teal/50! text-teal animate-pulso"
                : state.turn
                  ? "text-crema"
                  : "turn-banner--resolving border-crema/10! text-crema/55")
            }
            data-testid="turn-banner"
          >
            {state.turn ? (
              <span
                className={
                  "inline-block h-2.5 w-2.5 rounded-full " +
                  (myTurn
                    ? "bg-teal shadow-[0_0_8px_var(--color-teal)]"
                    : "bg-oro animate-pulse")
                }
              />
            ) : (
              <Spinner testId="turn-wait-spinner" />
            )}
            {myTurn
              ? "¡Tu turno! Jugá una carta o cantá algo."
              : state.turn ? `Turno de ${state.turn}` : "Preparando siguiente jugada…"}
          </div>
        </div>
      )}

      {!you ? (
        <SpectatorArena
          players={others}
          mano={state.mano}
          turn={state.turn}
          pendingStep={pendingStep}
          callVigente={state.call_vigente}
          tableEvents={state.table_events}
          eventsSupported={Array.isArray(state.table_events)}
          stepMode={spectatorStepMode}
          finished={state.finished}
          engineConfig={state.engine_config}
          autoPlay={autoPlay}
          setAutoPlay={setAutoPlay}
          autoDelay={autoDelay}
          setAutoDelay={setAutoDelay}
          stepping={stepping}
          stepSource={stepSource}
          recovering={Boolean(state.recovering)}
          lastAgentDecision={state.last_agent_decision}
          dealPhase={dealPhase}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((enabled) => !enabled)}
          onStep={step}
          scoreboard={(
            <Scoreboard
              teams={state.teams}
              target={state.target_score}
              winner={state.winner}
              finished={state.finished}
            />
          )}
        />
      ) : (
        <div
          className="paño game-shell game-player-stage relative flex flex-1 flex-col overflow-hidden
                     items-center justify-center gap-4 py-2"
        >
        <div className="player-table-scoreboard" data-testid="table-scoreboard">
          <Scoreboard
            teams={state.teams}
            target={state.target_score}
            winner={state.winner}
            finished={state.finished}
          />
        </div>
        {dealPhase && (
          <DealSequence phase={dealPhase} playerCount={others.length + 1} />
        )}
        {/* compañero enfrente en 2v2 */}
        {partner && (
          <PlayerSlot
            player={partner}
            isMano={state.mano === partner.name}
            isTurn={state.turn === partner.name}
            side="top"
            dataTestid={`slot-${partner.name}`}
            onSena={() => setSenaAbierta((v) => !v)}
            senaAbierta={senaAbierta}
            senas={SENAS}
            onElegirSena={mandarSena}
          />
        )}

        <div className="fila-media flex w-full items-center justify-center gap-4">
          {rivals[0] && (
            <PlayerSlot
              player={rivals[0]}
              isMano={state.mano === rivals[0].name}
              isTurn={state.turn === rivals[0].name}
              side="left"
              dataTestid={`slot-${rivals[0].name}`}
            />
          )}

          <div
            className="centro flex flex-1 items-center justify-center"
            data-testid="centro"
          >
            <div
              className="bazas glass-panel flex min-w-[280px] flex-col gap-3
                         rounded-xl px-5 py-4"
            >
              <span className="baza-titulo text-center text-[0.62rem] font-bold
                                uppercase tracking-widest text-crema/40">
                Baza actual
              </span>
              {rivals.map((r) => (
                <BazaRow key={r.name} name={r.name} cards={r.played} />
              ))}
              {partner && (
                <BazaRow name={partner.name} cards={partner.played} />
              )}
              <BazaRow name={you.name} cards={you.played} own />
            </div>
          </div>

          {rivals[1] && (
            <PlayerSlot
              player={rivals[1]}
              isMano={state.mano === rivals[1].name}
              isTurn={state.turn === rivals[1].name}
              side="right"
              dataTestid={`slot-${rivals[1].name}`}
            />
          )}
        </div>

        </div>
      )}

      <div className="pie flex justify-center px-4 pb-6 pt-2">
        {you && (
          <div
            className={
              "mi-zona flex flex-col items-center gap-2 " +
              (state.mano === seat ? "player-own-zone--mano" : "")
            }
            data-testid="mi-zona"
          >
            <div className="quien text-base text-crema">
              <strong>{seat}</strong>
              {state.mano === seat && <span className="chip inline-block ml-1.5 rounded-full bg-oro/20 border border-oro/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-oro">MANO</span>}
              {myTurn && <span className="chip turno inline-block ml-1.5 rounded-full bg-teal/20 border border-teal/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-teal animate-pulso">TU TURNO</span>}
            </div>
            <AgentIdentity player={you} />
            {state.call_vigente && !state.finished && (
              <p
                className="banner-canto glass-panel flex items-center gap-2 rounded-full
                           border-violeta/40! px-4 py-1.5 text-sm text-violeta
                           shadow-[0_0_20px_rgba(168,85,247,0.18)]"
                data-testid="banner-canto"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-violeta animate-pulso-violeta" />
                {bannerTexto(state, seat)}
              </p>
            )}
            {you.pending ? (
              <Actions pending={you.pending} onAction={(p) => send(p)} />
            ) : myTurn ? (
              <p className="text-crema">Es tu turno: jugá una carta.</p>
            ) : (
              !state.finished && (
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-sm italic text-crema/70" data-testid="esperando">
                    Esperando a {state.turn || "que se resuelva la jugada"}…
                  </p>
                  <p className="text-xs text-crema/45">
                    ¿Jugás los dos asientos vos? Abrí la invitación en otra
                    pestaña de incógnito y elegí "{state.turn}".
                  </p>
                  <button
                    type="button"
                    data-testid="copiar-invitacion"
                    onClick={copiarInvitacion}
                    className="glass-panel rounded-full px-3 py-1 text-xs text-teal
                               transition hover:border-teal/40!"
                  >
                    Copiar invitación
                  </button>
                </div>
              )
            )}
            {myTurn && (
              <label
                className="toggle-tapada inline-flex cursor-pointer items-center
                           gap-1.5 text-sm text-crema"
                data-testid="toggle-tapada"
              >
                <input
                  type="checkbox"
                  checked={tapada}
                  onChange={(e) => setTapada(e.target.checked)}
                />
                Jugar boca abajo
              </label>
            )}
            <Hand cards={you.hand} myTurn={myTurn} onPlay={playCard} />
          </div>
        )}
      </div>

      <div className="historial-dock fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
        <button
          type="button"
          data-testid="toggle-historial"
          onClick={() => setHistorialAbierto((v) => !v)}
          className="glass-panel rounded-full px-3 py-1.5 text-xs text-crema/70
                     transition hover:border-teal/40! hover:text-teal"
        >
          📜 Historial {historialAbierto ? "▲" : "▼"} ({historial.length})
        </button>
        {historialAbierto && (
          <div
            className="historial glass-panel max-h-64 w-72 overflow-y-auto rounded-xl
                       px-3 py-2 font-mono text-xs text-crema/80"
            data-testid="historial"
          >
            {historial.length === 0 ? (
              <p className="text-crema/40">Todavía no hay jugadas registradas.</p>
            ) : (
              historial
                .slice()
                .reverse()
                .map((linea, i) => (
                  <p key={i} className="mb-1 border-b border-glass-border/60 pb-1
                                          last:mb-0 last:border-0 last:pb-0">
                    {linea}
                  </p>
                ))
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          className="toast-sena glass-panel animate-jugar fixed bottom-38 left-1/2 z-40
                     -translate-x-1/2 rounded-full border-teal/40! px-5 py-2 font-bold
                     text-teal shadow-xl shadow-black/45"
          data-testid="toast-sena"
        >
          {toast}
        </div>
      )}

      {actionError && (
        <div
          className="toast-error animate-jugar fixed bottom-52 left-1/2 z-40
                     -translate-x-1/2 rounded-full bg-red-700 px-5 py-2 font-bold
                     text-white shadow-xl shadow-black/45"
          data-testid="toast-error"
        >
          {actionError}
        </div>
      )}

      {state.finished && (
        <div
          className="overlay fixed inset-0 flex flex-col items-center justify-center
                     gap-4 bg-base-deep/92 backdrop-blur-sm text-crema"
          data-testid="fin-partida"
        >
          <h2 className="text-2xl font-bold">
            {state.error
              ? "Partida interrumpida"
              : `🏆 Ganó ${winnerDisplayName(state.teams, state.winner)}`}
          </h2>
          {state.error && (
            <p className="max-w-md px-5 text-center text-sm text-crema/65">
              {state.error}
            </p>
          )}
          <button
            type="button"
            onClick={revancha}
            className="rounded-full bg-teal/20 border border-teal/50 px-8 py-2.5
                       font-bold text-teal shadow-[0_0_24px_rgba(46,230,196,0.2)]
                       transition hover:bg-teal/30"
          >
            Revancha
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="rounded-full border border-crema/40 px-8 py-2.5 font-bold text-crema"
          >
            Lobby
          </button>
        </div>
      )}
    </main>
  );
}

function bannerTexto(state, seat) {
  const call = state.call_vigente;
  const esMiTurno = state.turn === seat;
  const base = call === "flor" ? "¡Flor!" : CALL_LABELS[call] || call;
  const texto = call === "envido" || call === "truco" ? `${base} cantado` : base;
  return esMiTurno
    ? `${texto} — te toca decidir`
    : `${texto}: esperando a ${state.turn}`;
}

function SpectatorArena({
  players,
  mano,
  turn,
  pendingStep,
  callVigente,
  tableEvents,
  eventsSupported,
  stepMode,
  finished,
  engineConfig,
  autoPlay,
  setAutoPlay,
  autoDelay,
  setAutoDelay,
  stepping,
  stepSource,
  recovering,
  lastAgentDecision,
  dealPhase,
  soundEnabled,
  onToggleSound,
  onStep,
  scoreboard,
}) {
  const feltRef = useRef(null);
  const playedCountsRef = useRef(null);
  const flightTimerRef = useRef(null);
  const flightIdRef = useRef(0);
  const [cardFlight, setCardFlight] = useState(null);
  const teamNames = [...new Set(players.map((player) => player.team))];
  const teams = teamNames.map((name) => ({
    name,
    players: players.filter((player) => player.team === name),
  }));
  const showStepStatus = !autoPlay && !stepping && Boolean(pendingStep);
  const responsePlayer = pendingStep?.kind === "response" ? pendingStep.player : null;
  const activeCall = latestCallAnnouncement(tableEvents, callVigente, responsePlayer);

  useLayoutEffect(() => {
    const nextCounts = new Map(
      players.map((player) => [player.name, (player.played || []).length])
    );
    const previousCounts = playedCountsRef.current;
    if (!previousCounts) {
      playedCountsRef.current = nextCounts;
      return;
    }
    // Si una carta llega mientras todavía se representa el reparto, se deja
    // pendiente para animarla apenas se despeja el paño en vez de perderla.
    if (dealPhase) return;
    playedCountsRef.current = nextCounts;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const player = players.find(
      (candidate) => (candidate.played || []).length > (previousCounts.get(candidate.name) || 0)
    );
    if (!player) return;
    const card = (player.played || []).at(-1);
    const felt = feltRef.current;
    const key = playerDomKey(player.name);
    const source = felt?.querySelector(`[data-flight-hand="${key}"]`);
    const target = felt?.querySelector(`[data-flight-target="${key}"]`);
    if (!card || !felt || !source || !target) return;

    const feltRect = felt.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const cardWidth = 60;
    const cardHeight = 92;
    const from = {
      x: sourceRect.left - feltRect.left + sourceRect.width / 2 - cardWidth / 2,
      y: sourceRect.top - feltRect.top + sourceRect.height / 2 - cardHeight / 2,
    };
    const to = {
      x: targetRect.left - feltRect.left + targetRect.width / 2 - cardWidth / 2,
      y: targetRect.top - feltRect.top + targetRect.height / 2 - cardHeight / 2,
    };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    flightIdRef.current += 1;
    setCardFlight({
      id: flightIdRef.current,
      playerName: player.name,
      card,
      from,
      dx,
      dy,
      midX: dx * 0.58,
      midY: dy * 0.58 - Math.min(74, 28 + Math.abs(dy) * 0.12),
    });

    clearTimeout(flightTimerRef.current);
    flightTimerRef.current = setTimeout(() => {
      setCardFlight(null);
      if (soundEnabled) playTableSound("card");
    }, 620);
  }, [dealPhase, players, soundEnabled]);

  useEffect(() => () => {
    clearTimeout(flightTimerRef.current);
  }, []);

  return (
    <section
      className="spectator-arena game-shell flex flex-1 flex-col gap-4 pb-6 pt-3"
      data-testid="spectator-arena"
      aria-label="Mesa de agentes en vivo"
    >
      <div className="spectator-heading flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-teal/70">
            Mesa de agentes
          </p>
          <h2 className="font-serif-display text-lg text-crema">Vista en vivo</h2>
          {engineConfig?.kind === "llm" && llmIdentity(engineConfig) && (
            <p
              className="mt-0.5 text-[0.62rem] font-semibold text-crema/55"
              data-testid="engine-llm-identity"
            >
              Motor de reglas · {llmIdentity(engineConfig)}
            </p>
          )}
          {!eventsSupported && stepMode && (
            <p
              className="mt-1 inline-flex rounded-full border border-oro/35 bg-oro/10 px-2 py-0.5
                         text-[0.58rem] font-semibold text-oro"
              data-testid="legacy-events-warning"
              role="status"
            >
              Servidor sin registro de cantos · reiniciá el backend
            </p>
          )}
        </div>
        <div className="spectator-tools flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="sound-toggle inline-flex min-h-9 items-center gap-1.5 rounded-full border
                       border-crema/15 bg-black/15 px-3 text-xs font-semibold text-crema/70
                       transition hover:border-teal/40 hover:text-teal focus-visible:outline-2
                       focus-visible:outline-offset-2 focus-visible:outline-teal"
            data-testid="table-sound-toggle"
            aria-pressed={soundEnabled}
            aria-label={`${soundEnabled ? "Desactivar" : "Activar"} sonidos de la mesa`}
            onClick={onToggleSound}
          >
            <span aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
            Sonido
          </button>
          <span
            className={
              "rounded-full border px-3 py-1 text-xs font-semibold " +
              (autoPlay
                ? "border-teal/35 bg-teal/10 text-teal"
                : "border-oro/35 bg-oro/10 text-oro")
            }
            data-testid="spectator-status"
          >
            {autoPlay
              ? `Automático · ${autoDelay / 1000}s entre cartas`
              : "Pausado · avance manual"}
          </span>
          {lastAgentDecision?.source === "fallback" && (
            <span
              className="rounded-full border border-oro/40 bg-oro/10 px-3 py-1 text-xs font-semibold text-oro"
              data-testid="agent-fallback-status"
              title={FALLBACK_REASON_LABELS[lastAgentDecision.reason]
                || "El proveedor no devolvió una opción válida"}
            >
              Fallback legal · {lastAgentDecision.player}
            </span>
          )}
        </div>
      </div>

      <div
        className="spectator-felt relative flex flex-1 flex-col justify-between overflow-hidden
                   rounded-[2.75rem] border border-teal/25 px-4 py-4
                   shadow-[inset_0_0_90px_rgba(0,0,0,0.62),0_24px_65px_rgba(0,0,0,0.38)]
                   sm:px-7 sm:py-5"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(40,112,81,.62) 0%, rgba(18,69,50,.82) 48%, rgba(7,35,26,.98) 100%)",
        }}
        data-testid="spectator-felt"
        aria-label="Paño de la mesa de truco"
        ref={feltRef}
      >
        <div className="pointer-events-none absolute inset-2 rounded-[2.25rem] border border-crema/10" />

        {dealPhase && (
          <DealSequence phase={dealPhase} playerCount={players.length} />
        )}

        {cardFlight && <CardFlight flight={cardFlight} />}

        <div className="spectator-table-head">
          <div className="table-scoreboard" data-testid="table-scoreboard">
            {scoreboard}
          </div>
          {teams[0] && (
            <SpectatorTeam
              team={teams[0]}
              mano={mano}
              turn={turn}
              side="top"
            />
          )}
          <span className="spectator-table-head__balance" aria-hidden="true" />
        </div>

        <div className="spectator-middle" data-testid="spectator-middle">
          <SpectatorTrick
            players={players}
            receivingPlayer={cardFlight?.playerName || null}
            waitStatus={
              recovering
                ? "Recuperando la mano…"
                : stepping
                  ? stepSource === "autoplay"
                    ? "Resolviendo jugada automática…"
                    : "Resolviendo jugada manual…"
                  : stepMode && !pendingStep && !finished
                    ? "Preparando jugada…"
                    : null
            }
          />
          <TableCallChat
            players={players}
            events={tableEvents}
            current={activeCall}
          />
        </div>

        {teams[1] && (
          <SpectatorTeam
            team={teams[1]}
            mano={mano}
            turn={turn}
            side="bottom"
          />
        )}
      </div>

      {stepMode && !finished && (
        <div
          className={
            "step-controls glass-panel rounded-2xl border-teal/25! shadow-lg shadow-black/25 " +
            (showStepStatus
              ? "flex flex-col items-stretch justify-between gap-3 px-4 py-3 " +
                "sm:flex-row sm:items-center"
              : "step-controls--collapsed flex flex-row items-center justify-center px-2 py-2")
          }
          data-testid="step-controls"
          data-collapsed={showStepStatus ? "false" : "true"}
        >
          {showStepStatus && (
            <p className="step-controls__status text-sm text-crema/75">
              Próxima movida
              <span className="mx-2 text-crema/25">/</span>
              <strong className="text-crema">{pendingStep.player}</strong>{" "}
              <span>{STEP_KIND_LABEL[pendingStep.kind] || pendingStep.kind}</span>
            </p>
          )}
          <div className="step-controls__actions flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="siguiente-movida"
              disabled={stepping || !pendingStep}
              aria-busy={stepping}
              onClick={() => {
                setAutoPlay(false);
                onStep("manual");
              }}
              className="step-controls__next min-h-11 rounded-full border border-teal/50 bg-teal/20 px-5
                         text-sm font-bold text-teal shadow-[0_0_16px_rgba(46,230,196,0.18)]
                         transition hover:bg-teal/30 focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-teal
                         disabled:cursor-not-allowed disabled:opacity-60"
            >
              Siguiente movida
            </button>
            <label className="flex min-h-11 items-center gap-2 rounded-full border
                              border-crema/15 px-3 text-xs text-crema">
              <input
                type="checkbox"
                data-testid="auto-play"
                checked={autoPlay}
                onChange={(event) => setAutoPlay(event.target.checked)}
              />
              Automático
            </label>
            <select
              data-testid="auto-play-delay"
              aria-label="Delay entre cartas"
              value={autoDelay}
              disabled={!autoPlay}
              onChange={(event) => setAutoDelay(Number(event.target.value))}
              className="min-h-11 rounded-full border border-crema/20 bg-base-deep px-3
                         text-xs text-crema disabled:opacity-45"
            >
              {AUTOPLAY_DELAYS.map((delay) => (
                <option key={delay.ms} value={delay.ms}>
                  {delay.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
}

function DealSequence({ phase, playerCount }) {
  const dealCount = Math.min(Math.max(playerCount * 3, 6), 12);
  const destinations = [
    [-118, -92], [118, 92], [-76, -112], [76, 112], [-142, -58], [142, 58],
    [-126, 76], [126, -76], [-52, -124], [52, 124], [-154, 12], [154, -12],
  ];

  return (
    <div
      className={`deal-sequence deal-sequence--${phase}`}
      data-testid="deal-sequence"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="deal-sequence__halo" />
      <div className="deal-sequence__visual" aria-hidden="true">
        {phase === "shuffle" ? (
          Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className="deal-sequence__shuffle-card"
              style={{
                "--shuffle-offset": `${index * 2}px`,
                "--shuffle-angle": `${(index - 1.5) * 2}deg`,
                "--shuffle-left": `${-34 + index * 3}px`,
                "--shuffle-right": `${34 - index * 2}px`,
                "--shuffle-delay": `${index * -70}ms`,
              }}
            >
              <CardBack className="spanish-card-back--deal" />
            </span>
          ))
        ) : (
          Array.from({ length: dealCount }, (_, index) => {
            const [x, y] = destinations[index];
            return (
              <span
                key={index}
                className="deal-sequence__flying-card"
                style={{
                  "--deal-x": `${x}px`,
                  "--deal-y": `${y}px`,
                  "--deal-delay": `${index * 55}ms`,
                }}
              >
                <CardBack className="spanish-card-back--deal" />
              </span>
            );
          })
        )}
      </div>
      <div className="deal-sequence__message glass-panel">
        <span className="deal-sequence__eyebrow">Nueva mano</span>
        <strong>{phase === "shuffle" ? "Mezclando el mazo…" : "Repartiendo cartas…"}</strong>
      </div>
    </div>
  );
}

function CardFlight({ flight }) {
  const cardLabel = flight.card.tapada
    ? "una carta boca abajo"
    : `${flight.card.numero} de ${flight.card.palo}`;
  return (
    <div
      className="card-flight-status"
      role="status"
      aria-live="polite"
      data-testid={`card-flight-${flight.playerName}`}
    >
      <span className="sr-only">{flight.playerName} jugó {cardLabel}</span>
      <span
        className="card-flight"
        aria-hidden="true"
        style={{
          left: `${flight.from.x}px`,
          top: `${flight.from.y}px`,
          "--flight-x": `${flight.dx}px`,
          "--flight-y": `${flight.dy}px`,
          "--flight-mid-x": `${flight.midX}px`,
          "--flight-mid-y": `${flight.midY}px`,
        }}
      >
        {flight.card.tapada ? (
          <CardBack className="spanish-card-back--trick" />
        ) : (
          <SpanishCard card={flight.card} size="trick" />
        )}
      </span>
    </div>
  );
}

function SpectatorTrick({
  players,
  waitStatus = null,
  receivingPlayer = null,
}) {
  const columns = players.length > 2 ? "sm:grid-cols-4" : "sm:grid-cols-2";
  const trickNumber = Math.max(
    0,
    ...players.map((player) => (player.played || []).length)
  );
  const currentCards = new Map(
    players.map((player) => {
      const played = player.played || [];
      return [
        player.name,
        trickNumber > 0 && played.length === trickNumber ? [played.at(-1)] : [],
      ];
    })
  );

  return (
    <section
      className="spectator-trick relative z-20 my-3 overflow-hidden rounded-[2rem]
                 border border-oro/25 px-3 pb-3 pt-8
                 shadow-[inset_0_0_36px_rgba(0,0,0,0.38),0_10px_28px_rgba(0,0,0,0.22)]"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(79,145,91,.68) 0%, rgba(31,91,61,.88) 62%, rgba(12,54,39,.96) 100%)",
      }}
      data-testid="spectator-trick"
      aria-label="Paño de cartas jugadas"
    >
      <div className="pointer-events-none absolute inset-y-5 left-1/2 border-l
                      border-dashed border-crema/12" />
      <h3
        className={
          "absolute left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 " +
          "items-center justify-center gap-2 whitespace-nowrap bg-base-deep/90 px-4 py-1 " +
          "text-center font-bold uppercase " +
          (waitStatus
            ? "top-1/2 -translate-y-1/2 rounded-full border border-teal/30 " +
              "text-[0.62rem] tracking-[0.08em] text-teal"
            : "top-0 rounded-b-xl border-x border-b border-oro/25 " +
              "text-[0.58rem] tracking-[0.24em] text-oro/80")
        }
        data-testid={waitStatus ? "table-wait-status" : undefined}
        aria-live="polite"
      >
        {waitStatus ? (
          <>
            <Spinner testId="step-wait-spinner" />
            <span className="truncate">{waitStatus}</span>
          </>
        ) : (
          <>Baza en juego {trickNumber > 0 && <span>· {trickNumber}.ª</span>}</>
        )}
      </h3>
      <div className={`spectator-trick__grid grid h-full grid-cols-2 gap-2 ${columns}`}>
        {players.map((player) => (
          <PlayedCardsSpot
            key={player.name}
            player={player}
            cards={currentCards.get(player.name)}
            receiving={receivingPlayer === player.name}
          />
        ))}
      </div>
    </section>
  );
}

function TableCallChat({ players, events, current }) {
  const logRef = useRef(null);
  const messages = (events || []).filter(
    (event) => event.type === "call" || event.type === "call_response"
  );
  if (messages.length === 0 && current?.player) {
    messages.push({
      id: "legacy-current-call",
      type: "call",
      player: current.player,
      call: current.call,
    });
  }
  const lastMessageId = messages.at(-1)?.id;
  const respondingPlayer = current?.live ? current.responder : null;
  const participantMeta = new Map(
    players.map((player, index) => [player.name, {
      side: index % 2 === 0 ? "left" : "right",
      tone: CHAT_TONES[index % CHAT_TONES.length],
    }])
  );

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lastMessageId]);

  return (
    <section
      className="table-call-chat"
      data-testid="table-call-chat"
      aria-label="Conversación de cantos de la mesa"
    >
      <header className="table-call-chat__header">
        <div>
          <span>Conversación</span>
          <strong>Mesa en vivo</strong>
        </div>
        <small>{messages.length} mensaje{messages.length === 1 ? "" : "s"}</small>
      </header>
      {messages.length > 0 ? (
        <div
          className="table-call-chat__log"
          data-testid="call-announcement-table"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          ref={logRef}
        >
          {messages.map((event) => {
            const isResponse = event.type === "call_response";
            const meta = participantMeta.get(event.player) || {
              side: "left",
              tone: "teal",
            };
            return (
              <article
                key={event.id}
                className={
                  `table-call-chat__bubble table-call-chat__bubble--${meta.side} ` +
                  `table-call-chat__bubble--${meta.tone}`
                }
                data-testid={`call-chat-message-${event.id}`}
              >
                <header>
                  <strong>{event.player}</strong>
                  <span>#{event.id}</span>
                </header>
                <p>
                  {isResponse
                    ? CALL_RESPONSE_LABELS[event.response] || event.response
                    : `¡${CALL_LABELS[event.call] || event.call}!`}
                </p>
                <small>
                  {isResponse
                    ? `respondió a ${CALL_LABELS[event.call] || event.call}`
                    : "cantó"}
                </small>
              </article>
            );
          })}
          {respondingPlayer && (
            <p
              className={
                "table-call-chat__typing " +
                `table-call-chat__typing--${participantMeta.get(respondingPlayer)?.side || "left"}`
              }
              data-testid={`call-typing-${respondingPlayer}`}
            >
              <Spinner /> {respondingPlayer} está pensando…
            </p>
          )}
        </div>
      ) : (
        <p
          className="table-call-chat__empty"
          data-testid={respondingPlayer
            ? `call-typing-${respondingPlayer}`
            : "no-call-status-table"}
        >
          {respondingPlayer
            ? <><Spinner /> {respondingPlayer} está pensando…</>
            : "Todavía no hubo cantos"}
        </p>
      )}
    </section>
  );
}

function PlayedCardsSpot({ player, cards, receiving }) {
  return (
    <div
      className="trick-seat flex min-w-0 flex-col items-center justify-center gap-2
                 rounded-xl border border-crema/8 bg-black/8 px-2 py-2"
      data-testid={`played-zone-${player.name}`}
      data-flight-target={playerDomKey(player.name)}
    >
      <span className="max-w-full truncate text-[0.65rem] font-semibold text-crema/75">
        {player.name}
      </span>
      <div
        className="flex min-h-[68px] items-center justify-center gap-1.5"
        aria-label={`Cartas jugadas por ${player.name}`}
      >
        {cards.map((card, index) => (
          <PlayedCard
            key={`${card.palo || "tapada"}-${card.numero || index}-${index}`}
            card={card}
            playerName={player.name}
            index={index}
            receiving={receiving}
          />
        ))}
        {cards.length === 0 && (
          <span
            className="trick-placeholder rounded-lg border border-dashed border-crema/22
                       bg-black/10 shadow-inner shadow-black/20"
            data-testid={`played-placeholder-${player.name}-0`}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function PlayedCard({ card, playerName, index, receiving }) {
  const landingClass = `trick-card-landing ${receiving ? "trick-card--receiving" : ""}`;
  if (card.tapada) {
    return (
      <CardBack
        className={`spanish-card-back--trick mini-carta tapada ${landingClass}`}
        testid={`played-card-${playerName}-${index}`}
      />
    );
  }

  return (
    <SpanishCard
      card={card}
      size="trick"
      className={`mini-carta ${landingClass}`}
      testid={`played-card-${playerName}-${index}`}
    />
  );
}

function SpectatorTeam({ team, mano, turn, side }) {
  const displayName = teamDisplayName(team);
  return (
    <div
      className="spectator-team relative z-20 min-w-0"
      data-testid={`spectator-team-${team.name}`}
    >
      <p
        className="spectator-team-label mb-1 truncate text-center text-[0.58rem] font-bold uppercase
                   tracking-[0.22em] text-crema/45"
        data-testid={`spectator-team-label-${team.name}`}
        title={team.players.length === 1 ? `Jugador · ${displayName}` : displayName}
      >
        {team.players.length === 1 ? `Jugador · ${displayName}` : displayName}
      </p>
      <div
        className="flex items-start justify-evenly gap-3"
        data-testid={`spectator-team-players-${team.name}`}
      >
        {team.players.map((player) => (
          <div
            key={player.name}
            className={`spectator-player-cluster spectator-player-cluster--${side}`}
          >
            <article
              data-testid={`spectator-player-${player.name}`}
              className={
                "spectator-player-panel spectator-player-card min-w-0 w-full max-w-sm rounded-2xl border " +
                "bg-black/20 px-3 py-2.5 " +
                "transition duration-300 sm:px-4 " +
                (mano === player.name ? "spectator-player-card--mano " : "") +
                (turn === player.name
                  ? "border-teal/70 shadow-[0_0_28px_rgba(46,230,196,0.2)]"
                  : "border-crema/10")
              }
            >
            <header className="spectator-player-header flex min-w-0 flex-nowrap items-center justify-center gap-1.5">
              <h3
                className="spectator-player-name min-w-0 flex-1 truncate font-serif-display text-sm font-bold text-crema sm:text-base"
                data-testid={`spectator-player-name-${player.name}`}
                title={player.name}
              >
                {player.name}
              </h3>
              {mano === player.name && (
                <span className="rounded-full border border-oro/45 bg-oro/10 px-1.5 py-0.5
                                 text-[0.52rem] font-bold uppercase tracking-wide text-oro">
                  Mano
                </span>
              )}
              {turn === player.name && (
                <span className="animate-pulso rounded-full border border-teal/45 bg-teal/10
                                 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase
                                 tracking-wide text-teal">
                  Jugando
                </span>
              )}
            </header>
            <div className="spectator-player-agent">
              <AgentIdentity player={player} className="text-center" />
            </div>
            <div
              className="spectator-hand flex items-center justify-center gap-1.5 sm:gap-2"
              data-testid={`spectator-hand-${player.name}`}
              data-flight-hand={playerDomKey(player.name)}
              aria-label={`Mano de ${player.name}`}
            >
              {(player.hand || []).map((card, index) => (
                <SpectatorCard
                  key={`${card.palo}-${card.numero}-${index}`}
                  card={card}
                  playerName={player.name}
                  index={index}
                />
              ))}
              {Array.from({ length: Math.max(0, 3 - (player.hand || []).length) }, (_, index) => (
                <span
                  key={`empty-${index}`}
                  className="spectator-hand-placeholder"
                  data-testid={`spectator-hand-placeholder-${player.name}-${index}`}
                  aria-hidden="true"
                />
              ))}
              {(player.hand || []).length === 0 && (
                <span className="sr-only">{player.name} ya no tiene cartas en la mano</span>
              )}
            </div>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpectatorCard({ card, playerName, index }) {
  return (
    <SpanishCard
      card={card}
      size="spectator"
      className="animate-jugar"
      testid={`spectator-card-${playerName}-${index}`}
    />
  );
}

function AgentIdentity({ player, className = "" }) {
  if (!player.agent) return null;
  const bluffLevel = player.agent.bluff_level;
  const bluffLabel = BLUFF_LABELS[bluffLevel] || bluffLevel;
  return (
    <div className={`agent-meta mx-auto flex min-w-0 max-w-full flex-nowrap items-center
                    justify-center gap-1.5 overflow-hidden ${className}`}>
      <p
        className="agent-identity min-w-0 max-w-full flex-[1_1_auto] truncate rounded-full border border-teal/30
                   bg-teal/10 px-2 py-1 text-[0.66rem] font-bold tracking-[0.035em]
                   text-teal/90"
        data-testid={`agent-identity-${player.name}`}
        title={llmIdentity(player.agent)}
      >
        LLM · {llmIdentity(player.agent)}
      </p>
      {bluffLevel && (
        <p
          className={`picardia-badge picardia-badge--${bluffLevel}`}
          data-testid={`picardia-${player.name}`}
          title={`Nivel de picardía: ${bluffLabel}`}
        >
          <span aria-hidden="true">◆</span>
          Picardía · {bluffLabel}
        </p>
      )}
    </div>
  );
}

function PlayerSlot({ player, isMano, isTurn, side, dataTestid,
                      onSena, senaAbierta, senas, onElegirSena }) {
  const sideClass = "self-center";
  return (
    <div
      className={
        `slot ${side} ${isTurn ? "turno" : ""} ${isMano ? "slot--mano" : ""} ` +
        `player-slot-panel glass-panel min-w-0 max-w-full overflow-hidden rounded-xl ` +
        `px-3 py-2 outline outline-2 outline-transparent ` +
        `transition-shadow duration-200 ${sideClass} ` +
        (isTurn ? "shadow-[0_0_14px_rgba(46,230,196,0.4)] outline-teal!" : "")
      }
      data-testid={dataTestid}
    >
      <div
        className="nombre-jugador flex min-w-0 items-center gap-1.5 text-[0.95rem] text-crema"
        title={player.name}
      >
        <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
        {isMano && <span className="chip inline-block ml-1.5 rounded-full bg-oro/20 border border-oro/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-oro">MANO</span>}
        {isTurn && <span className="chip turno inline-block ml-1.5 rounded-full bg-teal/20 border border-teal/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-teal animate-pulso">JUGANDO</span>}
      </div>
      <AgentIdentity player={player} className="mt-1" />
      {onSena && (
        <div className="zona-senas relative inline-block">
          <button
            type="button"
            className="btn-sena glass-panel rounded-full px-3 py-1 text-xs font-normal
                       text-crema opacity-85 transition hover:opacity-100"
            data-testid={`btn-sena-${player.name}`}
            onClick={onSena}
            title="Enviar una seña a tu compañero"
          >
            😉 Seña
          </button>
          {senaAbierta && (
            <div
              className="paleta-senas glass-panel absolute left-1/2 top-[calc(100%+6px)] z-30
                         flex -translate-x-1/2 gap-1 rounded-full px-2 py-1"
              data-testid="paleta-senas"
            >
              {senas.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => onElegirSena(s)}
                  className="rounded-full px-2 py-1 text-xs text-crema
                             transition hover:bg-white/15"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BazaRow({ name, cards, own }) {
  return (
    <div className={`baza-row flex items-center gap-2 ${own ? "propia flex-row-reverse" : ""}`}>
      <span
        className={
          "baza-nombre w-21 text-xs text-[#cfe6d5] " +
          (own ? "text-left" : "text-right")
        }
      >
        {name}
      </span>
      <div className="baza-cartas flex min-h-[44px] gap-1.5">
        {(cards || []).map((c, i) =>
          c.tapada ? (
            <CardBack
              key={i}
              className="spanish-card-back--mini mini-carta tapada animate-jugar"
            />
          ) : (
            <SpanishCard
              key={i}
              card={c}
              size="mini"
              className="mini-carta animate-jugar"
            />
          )
        )}
      </div>
    </div>
  );
}
