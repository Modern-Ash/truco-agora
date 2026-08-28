import React from "react";
import SpanishCard, { CardBack } from "./SpanishCard.jsx";

export function CardFace({ card, onClick, disabled, testid }) {
  return (
    <SpanishCard
      card={card}
      onClick={onClick}
      disabled={disabled}
      testid={testid}
    />
  );
}

export default function Hand({ cards, myTurn, onPlay }) {
  if (!cards || cards.length === 0) {
    return (
      <div
        className="mano vacia flex min-h-[118px] items-center gap-2.5"
        data-testid="mano"
      >
        <CardBack className="spanish-card-back--hand" />
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
