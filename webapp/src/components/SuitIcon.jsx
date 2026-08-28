import React from "react";

/** Íconos SVG de los 4 palos del mazo español (oro, copa, espada, basto),
 * en vez de emojis Unicode ambiguos entre plataformas. */

function Oro(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" stroke="#6d4b08" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff3b0" strokeOpacity=".72" strokeWidth="1" />
      <path d="M12 5.8 14 9l3.7.7-2.6 2.7.5 3.8-3.6-1.7-3.6 1.7.5-3.8-2.6-2.7L10 9Z" fill="#8a6010" />
    </svg>
  );
}

function Copa(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 2.8h16l-1.6 8.1a6.7 6.7 0 0 1-5.2 5.2v3h4v2.1H6.8v-2.1h4v-3a6.7 6.7 0 0 1-5.2-5.2Z" fill="currentColor" stroke="#72251f" strokeWidth=".8" />
      <path d="M6.2 6.1h11.6M7.2 10.4h9.6" stroke="#ffd6af" strokeOpacity=".72" strokeWidth="1" />
    </svg>
  );
}

function Espada(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="m13.1 1.6 4 4L8.6 18.4l-3-3Z" fill="currentColor" stroke="#254150" strokeWidth=".8" />
      <path d="m13.5 3 1.9 1.9-7.8 11.7-1-1Z" fill="#d9edf3" fillOpacity=".75" />
      <path d="m4 15 5 5M3.2 18.3l3.5 3.5M15.2 4.2l4.2 4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Basto(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9.7 6h4.6l-1 16h-2.6Z" fill="currentColor" stroke="#31531f" strokeWidth=".7" />
      <path d="M12 1.2c3.8 0 5.2 2.7 3.5 5.2-1 1.5-2.1 1.8-3.5 3.3-1.4-1.5-2.5-1.8-3.5-3.3C6.8 3.9 8.2 1.2 12 1.2Z" fill="currentColor" stroke="#31531f" strokeWidth=".7" />
      <path d="M12 3v17" stroke="#dcefc5" strokeOpacity=".55" strokeWidth=".8" />
    </svg>
  );
}

const ICONS = { oro: Oro, copa: Copa, espada: Espada, basto: Basto };

export default function SuitIcon({ palo, className }) {
  const Icon = ICONS[palo];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}
