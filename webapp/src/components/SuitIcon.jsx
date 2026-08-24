import React from "react";

/** Íconos SVG de los 4 palos del mazo español (oro, copa, espada, basto),
 * en vez de emojis Unicode ambiguos entre plataformas. */

function Oro(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <circle cx="12" cy="12" r="9" stroke="black" strokeOpacity="0.25" strokeWidth="1" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="black" strokeOpacity="0.35" strokeWidth="1.4" />
    </svg>
  );
}

function Copa(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 3h14l-1.3 7.2a5.7 5.7 0 0 1-5.2 4.6v3.7h3.5v1.5H8v-1.5h3.5v-3.7a5.7 5.7 0 0 1-5.2-4.6L5 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Espada(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M11.3 2.5 15 6.2 8.4 18.6l-3-3L11.3 2.5Z" fill="currentColor" />
      <rect x="4.3" y="15.4" width="3" height="6.4" rx="0.6"
            transform="rotate(45 5.8 18.6)" fill="currentColor" />
      <rect x="12.5" y="4.3" width="6.2" height="1.7" rx="0.6"
            transform="rotate(45 15.6 5.1)" fill="currentColor" />
    </svg>
  );
}

function Basto(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="10.3" y="6" width="3.4" height="16" rx="1.5" fill="currentColor" />
      <circle cx="12" cy="4.6" r="3.4" fill="currentColor" />
    </svg>
  );
}

const ICONS = { oro: Oro, copa: Copa, espada: Espada, basto: Basto };

export default function SuitIcon({ palo, className }) {
  const Icon = ICONS[palo];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}
