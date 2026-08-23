import React, { useEffect, useState } from "react";
import Hand from "./Hand.jsx";
import Actions from "./Actions.jsx";
import Scoreboard from "./Scoreboard.jsx";
import { createMatch, getState, postAction } from "../api.js";
import { paloGlyph } from "../cartas.js";

export default function Table({ state: propState, matchId, seat }) {
  const [state, setState] = useState(propState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(propState);
  }, [propState]);

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
      // el polling mostrará el estado real; errores transitorios se ignoran
    } finally {
      setBusy(false);
    }
  }

  function playCard(card) {
    if (!myTurn || busy) return;
    send({ action: "play_card", card });
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
    <main className="mesa" data-testid="mesa">
      <div className="topbar">
        <Scoreboard
          teams={state.teams}
          target={state.target_score}
          winner={state.winner}
          finished={state.finished}
        />
        <div className="mazo" data-testid="mazo" title="Mazo">
          🂠
        </div>
      </div>

      <div className="paño">
        {/* compañero enfrente en 2v2 */}
        {partner && (
          <PlayerSlot
            player={partner}
            isMano={state.mano === partner.name}
            isTurn={state.turn === partner.name}
            side="top"
            dataTestid={`slot-${partner.name}`}
          />
        )}

        <div className="fila-media">
          {rivals[0] && (
            <PlayerSlot
              player={rivals[0]}
              isMano={state.mano === rivals[0].name}
              isTurn={state.turn === rivals[0].name}
              side="left"
              dataTestid={`slot-${rivals[0].name}`}
            />
          )}

          <div className="centro" data-testid="centro">
            {!you && <span className="hint">vista de espectador</span>}
            {you && (
              <>
                <div className="bazas">
                  {rivals.map((r) => (
                    <BazaRow key={r.name} name={r.name} cards={r.played} />
                  ))}
                  {partner && (
                    <BazaRow name={partner.name} cards={partner.played} />
                  )}
                  <BazaRow name={you.name} cards={you.played} own />
                </div>
              </>
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

      <div className="pie">
        {you && (
          <div className="mi-zona" data-testid="mi-zona">
            <div className="quien">
              <strong>{seat}</strong>
              {state.mano === seat && <span className="chip">MANO</span>}
              {myTurn && <span className="chip turno">TU TURNO</span>}
            </div>
            {state.call_vigente && !state.finished && (
              <p className="banner-canto" data-testid="banner-canto">
                {bannerTexto(state, seat)}
              </p>
            )}
            {you.pending ? (
              <Actions pending={you.pending} onAction={(p) => send(p)} />
            ) : (
              myTurn && <p>Es tu turno: jugá una carta.</p>
            )}
            <Hand cards={you.hand} myTurn={myTurn} onPlay={playCard} />
          </div>
        )}
      </div>

      {state.finished && (
        <div className="overlay" data-testid="fin-partida">
          <h2>{state.error ? "Partida interrumpida" : `🏆 Ganó ${state.winner}`}</h2>
          <button onClick={revancha}>Revancha</button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
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
  };
  const texto = mapa[call] || call;
  return esMiTurno
    ? `${texto} — te toca decidir`
    : `${texto}: esperando a ${state.turn}`;
}

function PlayerSlot({ player, isMano, isTurn, side, dataTestid }) {
  return (
    <div
      className={`slot ${side} ${isTurn ? "turno" : ""}`}
      data-testid={dataTestid}
    >
      <div className="nombre-jugador">
        {player.name}
        {isMano && <span className="chip">MANO</span>}
        {isTurn && <span className="chip turno">JUGANDO</span>}
      </div>
    </div>
  );
}

function BazaRow({ name, cards, own }) {
  return (
    <div className={`baza-row ${own ? "propia" : ""}`}>
      <span className="baza-nombre">{name}</span>
      <div className="baza-cartas">
        {(cards || []).map((c, i) => (
          <span key={i} className={`mini-carta palo-${c.palo}`}>
            <b>{c.numero}</b>
            {paloGlyph(c.palo)}
          </span>
        ))}
      </div>
    </div>
  );
}
