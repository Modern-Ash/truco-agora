import React from "react";

export default function Scoreboard({ teams, target, winner, finished }) {
  return (
    <div className="marcador" data-testid="marcador">
      <h3>A {target}</h3>
      {teams.map((t) => {
        const zona = target === 30 && t.score >= 15 ? "buenas" : "malas";
        return (
          <div
            key={t.name}
            className={`equipo ${finished && winner === t.name ? "campeon" : ""}`}
            data-testid={`equipo-${t.name}`}
          >
            <span className="nombre">{t.name}</span>
            <span className={`puntos ${zona}`}>{t.score}</span>
            <small>{target === 30 ? zona : "puntos"}</small>
          </div>
        );
      })}
    </div>
  );
}
