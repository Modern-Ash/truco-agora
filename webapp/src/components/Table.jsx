import React, { useEffect, useState } from "react";
import Hand from "./Hand.jsx";
import Actions from "./Actions.jsx";
import Scoreboard from "./Scoreboard.jsx";
import { createMatch, getState, postAction, postSena } from "../api.js";
import { paloGlyph } from "../cartas.js";

const SENAS = ["guiño", "lengua", "ceja", "beso", "suspiro"];

export default function Table({ state: propState, matchId, seat }) {
  const [state, setState] = useState(propState);
  const [busy, setBusy] = useState(false);
  const [tapada, setTapada] = useState(false);
  const [senaAbierta, setSenaAbierta] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    setState(propState);
  }, [propState]);

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
              <span className="hint italic text-[#bfd8c6]">vista de espectador</span>
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
              {state.mano === seat && <span className="chip">MANO</span>}
              {myTurn && <span className="chip turno">TU TURNO</span>}
            </div>
            {state.call_vigente && !state.finished && (
              <p
                className="banner-canto rounded-full bg-black/30 px-4 py-1.5 text-sm text-oro"
                data-testid="banner-canto"
              >
                {bannerTexto(state, seat)}
              </p>
            )}
            {you.pending ? (
              <Actions pending={you.pending} onAction={(p) => send(p)} />
            ) : (
              myTurn && <p className="text-crema">Es tu turno: jugá una carta.</p>
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
          className="toast-sena animate-jugar fixed bottom-38 left-1/2 z-40
                     -translate-x-1/2 rounded-full bg-oro px-5 py-2 font-bold
                     text-tinta shadow-xl shadow-black/45"
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
                     gap-4 bg-[#0a140e]/90 text-crema"
          data-testid="fin-partida"
        >
          <h2 className="text-2xl font-bold">
            {state.error ? "Partida interrumpida" : `🏆 Ganó ${state.winner}`}
          </h2>
          <button
            type="button"
            onClick={revancha}
            className="rounded-full bg-oro px-8 py-2.5 font-bold text-tinta shadow-lg"
          >
            Revancha
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="rounded-full border border-crema px-8 py-2.5 font-bold text-crema"
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
        `slot ${side} ${isTurn ? "turno" : ""} min-w-[120px] rounded-xl ` +
        `bg-black/18 px-3 py-2 outline outline-2 outline-transparent ` +
        `transition-shadow duration-200 ${sideClass} ` +
        (isTurn ? "shadow-[0_0_14px_rgba(255,215,110,0.45)] !outline-oro" : "")
      }
      data-testid={dataTestid}
    >
      <div className="nombre-jugador text-[0.95rem] text-crema">
        {player.name}
        {isMano && <span className="chip">MANO</span>}
        {isTurn && <span className="chip turno">JUGANDO</span>}
      </div>
      {onSena && (
        <div className="zona-senas relative inline-block">
          <button
            type="button"
            className="btn-sena rounded-full bg-crema px-3 py-1 text-xs font-normal
                       text-tinta opacity-85 transition hover:opacity-100"
            data-testid={`btn-sena-${player.name}`}
            onClick={onSena}
            title="Enviar una seña a tu compañero"
          >
            😉 Seña
          </button>
          {senaAbierta && (
            <div
              className="paleta-senas absolute left-1/2 top-[calc(100%+6px)] z-30
                         flex -translate-x-1/2 gap-1 rounded-full border
                         border-crema/35 bg-tinta px-2 py-1"
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
              className={`mini-carta palo-${c.palo} animate-jugar rounded bg-crema
                          px-1.5 py-0.5 text-sm shadow-md shadow-black/40`}
            >
              <b>{c.numero}</b>
              {paloGlyph(c.palo)}
            </span>
          )
        )}
      </div>
    </div>
  );
}
