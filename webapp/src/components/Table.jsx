import React, { useEffect, useState } from "react";
import Hand from "./Hand.jsx";
import Actions from "./Actions.jsx";
import Scoreboard from "./Scoreboard.jsx";
import { createMatch, getState, postAction, postSena, postStep } from "../api.js";
import SuitIcon from "./SuitIcon.jsx";

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

export default function Table({ state: propState, matchId, seat }) {
  const [state, setState] = useState(propState);
  const [busy, setBusy] = useState(false);
  const [tapada, setTapada] = useState(false);
  const [senaAbierta, setSenaAbierta] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoDelay, setAutoDelay] = useState(2000);
  const [stepping, setStepping] = useState(false);

  useEffect(() => {
    setState(propState);
  }, [propState]);

  const pendingStep = state.pending_step;

  async function step() {
    if (stepping) return;
    setStepping(true);
    try {
      setState(await postStep(matchId));
    } catch {
      // el polling repone el estado real si algo falla en el medio
    } finally {
      setStepping(false);
    }
  }

  // Auto-play (docs/step-mode.md): re-programa el próximo step con el
  // delay elegido, en vez de un setInterval fijo — así respeta el tiempo
  // real que tarda cada agente en decidir (puede variar mucho entre
  // proveedores) en lugar de superponer pedidos.
  useEffect(() => {
    if (!autoPlay || !pendingStep || state.finished) return;
    const t = setTimeout(() => { step(); }, autoDelay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, autoDelay, pendingStep?.player, pendingStep?.kind, state.finished]);

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
      setState(await getState(matchId, seat));
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
        players: cfg.players.map((name) => ({ name })),
      });
      window.location.href = `/mesa?match=${data.match_id}`;
    }
  }

  return (
    <main className="mesa mesa-bg flex min-h-screen flex-col" data-testid="mesa">
      <div className="topbar flex items-start justify-between px-4 py-3">
        <Scoreboard
          teams={state.teams}
          target={state.target_score}
          winner={state.winner}
          finished={state.finished}
        />
        <div
          className="mazo select-none text-4xl text-crema drop-shadow-md"
          data-testid="mazo"
          title="Mazo"
        >
          🂠
        </div>
      </div>

      {!state.finished && state.turn && (
        <div
          className={
            "turn-banner glass-panel mx-auto mb-1 flex items-center gap-2 rounded-full " +
            "px-5 py-2 font-serif-display text-sm font-bold shadow-lg shadow-black/30 " +
            (myTurn
              ? "border-teal/50! text-teal animate-pulso"
              : "text-crema")
          }
          data-testid="turn-banner"
        >
          <span
            className={
              "inline-block h-2.5 w-2.5 rounded-full " +
              (myTurn ? "bg-teal shadow-[0_0_8px_var(--color-teal)]" : "bg-oro animate-pulse")
            }
          />
          {myTurn ? "¡Tu turno! Jugá una carta o cantá algo." : `Turno de ${state.turn}`}
        </div>
      )}

      <div className="paño flex flex-1 flex-col px-4">
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

        <div className="fila-media flex flex-1 items-stretch gap-3">
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
            {!you && (
              <div className="flex flex-col items-center gap-3">
                <span className="hint italic text-[#bfd8c6]">vista de espectador</span>
                {others.length > 0 && (
                  <div className="bazas glass-panel flex flex-col gap-2 rounded-xl px-4 py-3">
                    {others.map((o) => (
                      <BazaRow key={o.name} name={o.name} cards={o.played} />
                    ))}
                  </div>
                )}
                {pendingStep && (
                  <div
                    className="step-controls glass-panel flex flex-col items-center gap-2
                               rounded-xl px-4 py-3"
                    data-testid="step-controls"
                  >
                    <p className="text-sm text-crema">
                      Próxima movida: <strong>{pendingStep.player}</strong> va a{" "}
                      {STEP_KIND_LABEL[pendingStep.kind] || pendingStep.kind}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="siguiente-movida"
                        disabled={stepping}
                        onClick={step}
                        className="rounded-full bg-teal/20 border border-teal/50 px-4 py-1.5
                                   text-sm font-bold text-teal shadow-[0_0_16px_rgba(46,230,196,0.18)]
                                   transition hover:bg-teal/30
                                   disabled:cursor-wait disabled:opacity-60"
                      >
                        {stepping ? "Jugando…" : "Siguiente movida"}
                      </button>
                      <label className="flex items-center gap-1 text-xs text-crema">
                        <input
                          type="checkbox"
                          data-testid="auto-play"
                          checked={autoPlay}
                          onChange={(e) => setAutoPlay(e.target.checked)}
                        />
                        Auto-play
                      </label>
                      <select
                        data-testid="auto-play-delay"
                        value={autoDelay}
                        disabled={!autoPlay}
                        onChange={(e) => setAutoDelay(Number(e.target.value))}
                        className="rounded border border-crema/30 bg-transparent
                                   px-1 py-0.5 text-xs text-crema disabled:opacity-50"
                      >
                        {AUTOPLAY_DELAYS.map((d) => (
                          <option key={d.ms} value={d.ms} className="text-tinta">
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
            {you && (
              <div className="bazas flex flex-col gap-2 rounded-xl bg-black/15 px-4 py-3">
                {rivals.map((r) => (
                  <BazaRow key={r.name} name={r.name} cards={r.played} />
                ))}
                {partner && (
                  <BazaRow name={partner.name} cards={partner.played} />
                )}
                <BazaRow name={you.name} cards={you.played} own />
              </div>
            )}
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

        {/* rival enfrente en 1v1 */}
        {!you && rivals.length === 1 && (
          <PlayerSlot
            player={rivals[0]}
            isMano={state.mano === rivals[0].name}
            isTurn={state.turn === rivals[0].name}
            side="bottom"
            dataTestid={`slot-${rivals[0].name}-b`}
          />
        )}
      </div>

      <div className="pie flex justify-center px-4 pb-6 pt-2">
        {you && (
          <div className="mi-zona flex flex-col items-center gap-2" data-testid="mi-zona">
            <div className="quien text-base text-crema">
              <strong>{seat}</strong>
              {state.mano === seat && <span className="chip inline-block ml-1.5 rounded-full bg-oro/20 border border-oro/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-oro">MANO</span>}
              {myTurn && <span className="chip turno inline-block ml-1.5 rounded-full bg-teal/20 border border-teal/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-teal animate-pulso">TU TURNO</span>}
            </div>
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
                    Esperando a {state.turn}…
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
            {state.error ? "Partida interrumpida" : `🏆 Ganó ${state.winner}`}
          </h2>
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
  const mapa = {
    envido: "Envido cantado",
    real_envido: "Real Envido",
    falta_envido: "Falta Envido",
    truco: "Truco cantado",
    retruco: "Retruco",
    vale_cuatro: "Vale Cuatro",
    flor: "¡Flor!",
    contraflor: "Contraflor",
    contraflor_al_resto: "Contraflor al resto",
  };
  const texto = mapa[call] || call;
  return esMiTurno
    ? `${texto} — te toca decidir`
    : `${texto}: esperando a ${state.turn}`;
}

function PlayerSlot({ player, isMano, isTurn, side, dataTestid,
                      onSena, senaAbierta, senas, onElegirSena }) {
  const sideClass = {
    top: "self-center",
    bottom: "self-center",
    left: "self-start mt-[15vh]",
    right: "self-start mt-[15vh]",
  }[side];
  return (
    <div
      className={
        `slot ${side} ${isTurn ? "turno" : ""} glass-panel min-w-[120px] rounded-xl ` +
        `px-3 py-2 outline outline-2 outline-transparent ` +
        `transition-shadow duration-200 ${sideClass} ` +
        (isTurn ? "shadow-[0_0_14px_rgba(46,230,196,0.4)] outline-teal!" : "")
      }
      data-testid={dataTestid}
    >
      <div className="nombre-jugador text-[0.95rem] text-crema">
        {player.name}
        {isMano && <span className="chip inline-block ml-1.5 rounded-full bg-oro/20 border border-oro/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-oro">MANO</span>}
        {isTurn && <span className="chip turno inline-block ml-1.5 rounded-full bg-teal/20 border border-teal/50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-teal animate-pulso">JUGANDO</span>}
      </div>
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
      <div className="baza-cartas flex min-h-[34px] gap-1">
        {(cards || []).map((c, i) =>
          c.tapada ? (
            <span
              key={i}
              className="mini-carta tapada animate-jugar rounded bg-[#1e4d3a]
                         px-1.5 py-0.5 text-lg text-crema/75 shadow-md shadow-black/40"
              title="Carta boca abajo"
            >
              🂠
            </span>
          ) : (
            <span
              key={i}
              className={`mini-carta palo-${c.palo} animate-jugar flex items-center gap-1
                          rounded bg-crema px-1.5 py-0.5 text-sm shadow-md shadow-black/40`}
            >
              <b>{c.numero}</b>
              <SuitIcon palo={c.palo} className="h-3.5 w-3.5" />
            </span>
          )
        )}
      </div>
    </div>
  );
}
