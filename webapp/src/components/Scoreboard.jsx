import React from "react";
import { teamDisplayName } from "../teamNames.js";

const STICKS = [
  { x1: 8, y1: 8, x2: 8, y2: 36, hx: 8, hy: 8 },
  { x1: 8, y1: 8, x2: 36, y2: 8, hx: 36, hy: 8 },
  { x1: 36, y1: 8, x2: 36, y2: 36, hx: 36, hy: 36 },
  { x1: 36, y1: 36, x2: 8, y2: 36, hx: 8, hy: 36 },
  { x1: 8, y1: 36, x2: 36, y2: 8, hx: 36, hy: 8 },
];

export default function Scoreboard({ teams, target, winner, finished }) {
  return (
    <section
      className="marcador glass-panel w-full max-w-xl min-w-0 rounded-2xl px-3 py-2.5
                 font-mono text-crema shadow-lg shadow-black/30 sm:px-4"
      data-testid="marcador"
      aria-label={`Marcador tradicional, partida a ${target} puntos`}
    >
      <header className="mb-2 flex items-center justify-between border-b
                         border-glass-border/80 pb-1.5">
        <h2 className="font-body text-[0.64rem] font-bold uppercase tracking-[0.2em]
                       text-crema/65">
          A {target} puntos
        </h2>
        <span className="text-[0.55rem] uppercase tracking-[0.16em] text-oro/70">
          5 por cuadro
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {teams.map((team) => (
          <TeamScore
            key={team.name}
            team={team}
            target={target}
            champion={finished && winner === team.name}
          />
        ))}
      </div>
    </section>
  );
}

function TeamScore({ team, target, champion }) {
  const displayName = teamDisplayName(team);
  const malas = Math.min(team.score, 15);
  const buenas = target === 30 ? Math.max(0, team.score - 15) : 0;
  const zona = target === 30 && team.score >= 15 ? "buenas" : "malas";

  return (
    <article
      className={
        "equipo min-w-0 rounded-xl border px-2 py-2 sm:px-3 " +
        (champion
          ? "campeon border-oro/55 bg-oro/10 shadow-[0_0_20px_rgba(232,184,75,.14)]"
          : "border-crema/10 bg-black/15")
      }
      data-testid={`equipo-${team.name}`}
      aria-label={`${displayName}: ${team.score} puntos${champion ? ", campeón" : ""}`}
    >
      <header className="mb-1.5 flex min-w-0 items-baseline gap-2">
        <h3
          className="nombre min-w-0 flex-1 truncate font-body text-xs font-semibold
                     text-crema sm:text-sm"
          title={displayName}
        >
          {displayName}
        </h3>
        <span
          className={
            "puntos text-xl font-bold tabular-nums leading-none sm:text-2xl " +
            zona + " " +
            (zona === "buenas" ? "text-oro" : "text-crema")
          }
        >
          {team.score}
        </span>
      </header>

      {target === 30 ? (
        <div className="space-y-1.5">
          <ScoreBand
            teamName={displayName}
            testIdName={team.name}
            label="Malas"
            points={malas}
          />
          <div className="border-t border-dashed border-crema/15 pt-1.5">
            <ScoreBand
              teamName={displayName}
              testIdName={team.name}
              label="Buenas"
              points={buenas}
              muted={buenas === 0}
            />
          </div>
        </div>
      ) : (
        <ScoreBand
          teamName={displayName}
          testIdName={team.name}
          label="Tantos"
          points={team.score}
        />
      )}
    </article>
  );
}

function ScoreBand({ teamName, testIdName, label, points, muted = false }) {
  return (
    <div
      className={"flex min-w-0 items-center gap-1 " + (muted ? "opacity-40" : "")}
      data-testid={`cerillos-${testIdName}-${label.toLowerCase()}`}
    >
      <span className="w-10 shrink-0 text-[0.5rem] font-bold uppercase tracking-wider
                       text-crema/45 sm:w-12">
        {label}
      </span>
      <div
        className="grid min-w-0 flex-1 grid-cols-3 gap-0.5 sm:gap-1"
        role="img"
        aria-label={`${teamName}, ${label.toLowerCase()}: ${points} puntos en cerillos`}
      >
        {[0, 1, 2].map((group) => (
          <TallyFive
            key={group}
            points={Math.max(0, Math.min(5, points - group * 5))}
            testId={`cerillo-grupo-${testIdName}-${label.toLowerCase()}-${group}`}
          />
        ))}
      </div>
    </div>
  );
}

function TallyFive({ points, testId }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className="aspect-square w-full max-w-11 overflow-visible"
      data-testid={testId}
      aria-hidden="true"
    >
      {STICKS.slice(0, points).map((stick, index) => (
        <g key={index} data-stick-active="true">
          <line
            x1={stick.x1}
            y1={stick.y1}
            x2={stick.x2}
            y2={stick.y2}
            stroke="#6f5127"
            strokeWidth="5.2"
            strokeLinecap="round"
          />
          <line
            x1={stick.x1}
            y1={stick.y1}
            x2={stick.x2}
            y2={stick.y2}
            stroke="#e8c86d"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx={stick.hx} cy={stick.hy} r="3.15" fill="#c94435" />
          <circle cx={stick.hx - 0.7} cy={stick.hy - 0.8} r="0.8" fill="#f08a66" />
        </g>
      ))}
    </svg>
  );
}
