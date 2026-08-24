import React from "react";

const LABELS = {
  envido: "Envido",
  real_envido: "Real Envido",
  falta_envido: "Falta Envido",
  truco: "Truco",
  retruco: "Retruco",
  vale_cuatro: "Vale Cuatro",
  quiero: "Quiero",
  no_quiero: "No Quiero",
  paso: "Paso",
  irse_al_mazo: "Irse al mazo",
  flor: "¡Flor!",
  con_flor_quiero: "Con flor quiero",
  con_flor_me_achico: "Con flor me achico",
  contraflor: "Contraflor",
  contraflor_al_resto: "Contraflor al resto",
};

export function actionLabel(opt) {
  return LABELS[opt] || opt;
}

export default function Actions({ pending, onAction }) {
  if (!pending) return null;
  const { decision, options, call } = pending;

  let buttons = [];
  if (decision === "offer") {
    buttons = options; // ["paso", "envido", ("flor")]
  } else if (decision === "action") {
    buttons = [...options.filter((o) => o !== "jugar")];
  } else if (decision === "response") {
    buttons = options;
  }

  return (
    <div
      className="acciones flex flex-wrap justify-center gap-2"
      data-testid="acciones"
    >
      {buttons.map((opt) => (
        <button
          type="button"
          key={opt}
          data-testid={`accion-${opt}`}
          className={
            `accion ${opt.startsWith("no_") ? "neg" : "pos"} ` +
            "rounded-full px-5 py-2 font-serif-display font-bold shadow-lg " +
            "shadow-black/35 transition hover:brightness-107 " +
            (opt.startsWith("no_")
              ? "bg-rojo text-white"
              : "bg-crema text-tinta")
          }
          onClick={() =>
            onAction(
              decision === "offer"
                ? { respond: opt === "paso" ? "paso" : opt }
                : decision === "response"
                  ? { respond: opt }
                  : { call: opt }
            )
          }
        >
          {actionLabel(opt)}
        </button>
      ))}
      {decision === "action" && call && <small>{call}</small>}
    </div>
  );
}
