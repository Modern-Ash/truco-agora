import React from "react";
import { paloGlyph } from "../cartas.js";

export function CardFace({ card, onClick, disabled, testid }) {
  return (
    <button
      type="button"
      className={
        `carta palo-${card.palo} flex h-28 w-[74px] flex-col items-center ` +
        "justify-between rounded-xl border-none bg-crema py-1.5 font-serif-display " +
        "shadow-lg shadow-black/45 transition-transform duration-150 " +
        "enabled:cursor-pointer enabled:hover:-translate-y-2.5 " +
        "disabled:cursor-default disabled:opacity-80"
      }
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="carta-num text-xl font-bold">{card.numero}</span>
      <span className="carta-glyph text-3xl leading-none">{paloGlyph(card.palo)}</span>
    </button>
  );
}

export default function Hand({ cards, myTurn, onPlay }) {
  if (!cards || cards.length === 0) {
    return (
      <div
        className="mano vacia flex min-h-[118px] items-center gap-2.5"
        data-testid="mano"
      >
        <span className="dorso text-4xl text-crema/50">🂠</span>
      </div>
    );
  }
  return (
    <div
      className={"mano flex min-h-[118px] items-center gap-2.5 " + (myTurn ? "activa" : "")}
      data-testid="mano"
    >
      {cards.map((c, i) => (
        <CardFace
          key={`${c.palo}-${c.numero}-${i}`}
          card={c}
          testid={`carta-${c.palo}-${c.numero}`}
          disabled={!myTurn}
          onClick={() => onPlay(c)}
        />
      ))}
    </div>
  );
}
