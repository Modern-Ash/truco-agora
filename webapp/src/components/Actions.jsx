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
};

export function actionLabel(opt) {
  return LABELS[opt] || opt;
}

export default function Actions({ pending, onAction }) {
  if (!pending) return null;
  const { decision, options, call } = pending;

  let buttons = [];
  if (decision === "offer") {
    buttons = ["envido", "paso"];
  } else if (decision === "action") {
    buttons = [...options.filter((o) => o !== "jugar")];
  } else if (decision === "response") {
    buttons = options;
  }

  return (
    <div className="acciones" data-testid="acciones">
      {buttons.map((opt) => (
        <button
          key={opt}
          data-testid={`accion-${opt}`}
          className={`accion ${opt.startsWith("no_") ? "neg" : "pos"}`}
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
