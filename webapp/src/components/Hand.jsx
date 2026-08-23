import React from "react";
import { paloGlyph } from "../cartas.js";

export function CardFace({ card, onClick, disabled, testid }) {
  return (
    <button
      className={`carta palo-${card.palo}`}
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="carta-num">{card.numero}</span>
      <span className="carta-glyph">{paloGlyph(card.palo)}</span>
    </button>
  );
}

export default function Hand({ cards, myTurn, onPlay }) {
  if (!cards || cards.length === 0) {
    return (
      <div className="mano vacia" data-testid="mano">
        <span className="dorso">🂠</span>
      </div>
    );
  }
  return (
    <div className={`mano ${myTurn ? "activa" : ""}`} data-testid="mano">
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
