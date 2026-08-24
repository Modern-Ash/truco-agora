import React from "react";

export default function Scoreboard({ teams, target, winner, finished }) {
  return (
    <div
      className="marcador min-w-[150px] rounded-lg border-4 border-madera
                  bg-[#222c26] px-4 py-2 text-[#e8e3d5] shadow-lg"
      data-testid="marcador"
    >
      <h3 className="mb-1 text-xs opacity-70">A {target}</h3>
      {teams.map((t) => {
        const zona = target === 30 && t.score >= 15 ? "buenas" : "malas";
        return (
          <div
            key={t.name}
            className={
              "equipo mb-1 flex items-baseline gap-2 " +
              (finished && winner === t.name ? "campeon" : "")
            }
            data-testid={`equipo-${t.name}`}
          >
            <span className="nombre flex-1 text-sm">{t.name}</span>
            <span
              className={
                "puntos text-2xl font-bold " +
                zona + " " +
                (zona === "buenas" ? "text-oro" : "")
              }
            >
              {t.score}
            </span>
            <small className="text-[0.62rem] opacity-60">
              {target === 30 ? zona : "puntos"}
            </small>
          </div>
        );
      })}
    </div>
  );
}
