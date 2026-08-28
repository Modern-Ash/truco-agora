import React from "react";
import { paloName } from "../cartas.js";
import SuitIcon from "./SuitIcon.jsx";

const FIGURE_NAMES = { 10: "Sota", 11: "Caballo", 12: "Rey" };

function CourtFigure({ numero, palo }) {
  return (
    <svg
      className="spanish-card__court"
      viewBox="0 0 74 112"
      aria-hidden="true"
    >
      <path className="court-arch" d="M9 101V29Q37 4 65 29v72Z" />
      {numero === 12 && (
        <>
          <path className="court-gold" d="m24 24 5-12 8 9 8-9 5 12-4 6H28Z" />
          <circle className="court-skin" cx="37" cy="40" r="11" />
          <path className="court-ink" d="M27 38q10 8 20 0v8q-10 17-20 0Z" />
          <path className="court-red" d="M18 96q1-40 19-43 18 3 19 43Z" />
          <path className="court-gold" d="m37 57 7 13-7 18-7-18Z" />
        </>
      )}
      {numero === 11 && (
        <>
          <path className="court-ink" d="M15 79q7-32 29-38l15 7-7 9 7 9-15-2-9 33Z" />
          <path className="court-skin" d="M31 31q10-10 18 1l-5 18-14-4Z" />
          <path className="court-red" d="m24 91 8-37 16 3 9 34Z" />
          <path className="court-gold" d="M13 91q13-18 26-6 11 10 23 2l-3 12H16Z" />
        </>
      )}
      {numero === 10 && (
        <>
          <circle className="court-skin" cx="37" cy="35" r="10" />
          <path className="court-ink" d="M27 34q2-17 20-9l3 11-7-5-16 8Z" />
          <path className="court-red" d="M18 97q2-44 19-50 17 6 19 50Z" />
          <path className="court-gold" d="m19 64 18 17 18-17v14L37 96 19 78Z" />
        </>
      )}
      <g transform="translate(27 69)">
        <SuitIcon palo={palo} className="court-suit" />
      </g>
    </svg>
  );
}

function PipField({ numero, palo }) {
  return (
    <div className={`spanish-card__pips pips-${numero}`} aria-hidden="true">
      {Array.from({ length: numero }, (_, index) => (
        <SuitIcon key={index} palo={palo} className="spanish-card__pip" />
      ))}
    </div>
  );
}

export function CardBack({ className = "", testid, label = "Carta boca abajo" }) {
  return (
    <span
      className={`spanish-card-back ${className}`}
      data-testid={testid}
      role="img"
      aria-label={label}
    >
      <span className="spanish-card-back__frame">
        <span className="spanish-card-back__sun" />
      </span>
    </span>
  );
}

export default function SpanishCard({
  card,
  size = "hand",
  onClick,
  disabled = false,
  testid,
  className = "",
}) {
  const Tag = onClick ? "button" : "span";
  const figure = FIGURE_NAMES[card.numero];
  const label = `${figure ? `${figure}, ` : ""}${card.numero} de ${paloName(card.palo)}`;

  return (
    <Tag
      {...(onClick ? { type: "button", disabled, onClick } : {})}
      className={`spanish-card spanish-card--${size} palo-${card.palo} ${className}`}
      data-testid={testid}
      aria-label={label}
      title={label}
    >
      <span className="spanish-card__inner">
        <span className="spanish-card__corner spanish-card__corner--top">
          <b>{card.numero}</b>
          <SuitIcon palo={card.palo} />
        </span>
        <span className="spanish-card__art">
          {figure
            ? <CourtFigure numero={card.numero} palo={card.palo} />
            : <PipField numero={card.numero} palo={card.palo} />}
        </span>
        <span className="spanish-card__corner spanish-card__corner--bottom">
          <b>{card.numero}</b>
          <SuitIcon palo={card.palo} />
        </span>
        <span className="spanish-card__caption">{figure || paloName(card.palo)}</span>
      </span>
    </Tag>
  );
}
