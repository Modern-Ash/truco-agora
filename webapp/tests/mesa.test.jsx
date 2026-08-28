import React from "react";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Table from "../src/components/Table.jsx";
import Mesa from "../src/Mesa.jsx";
import { getState, postAction, postSena, postStep } from "../src/api.js";
import { matchConfigKey, spectatorKey } from "../src/matchStorage.js";
import { playTableSound } from "../src/tableAudio.js";

vi.mock("../src/api.js", () => ({
  getState: vi.fn(),
  postAction: vi.fn(),
  postSena: vi.fn(),
  postStep: vi.fn(),
}));

vi.mock("../src/tableAudio.js", () => ({
  playTableSound: vi.fn().mockResolvedValue(true),
}));

const BASE = {
  match_id: "m1",
  target_score: 30,
  finished: false,
  winner: null,
  error: null,
  mano: "Ana",
  turn: "Ana",
  call_vigente: null,
};

function estado1v1(over = {}) {
  return {
    ...BASE,
    teams: [
      { name: "Equipo 1", score: 4, players: ["Ana"] },
      { name: "Equipo 2", score: 2, players: ["Beto"] },
    ],
    others: [{ name: "Beto", team: "Equipo 2", played: [] }],
    you: {
      name: "Ana",
      team: "Equipo 1",
      hand: [
        { palo: "oro", numero: 7 },
        { palo: "espada", numero: 1 },
        { palo: "copa", numero: 12 },
      ],
      played: [],
      pending: null,
    },
    ...over,
  };
}

test("mesa muestra mano propia, rival y marcador integrado sin icono de mazo", () => {
  getState.mockResolvedValue(estado1v1());
  render(<Table state={estado1v1()} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("carta-oro-7")).toBeInTheDocument();
  expect(screen.getByTestId("carta-espada-1")).toBeInTheDocument();
  expect(screen.getByTestId("slot-Beto")).toBeInTheDocument();
  expect(screen.queryByTestId("mazo")).not.toBeInTheDocument();
  expect(screen.getByTestId("equipo-Equipo 1")).toHaveTextContent("4");
  expect(screen.getByTestId("table-scoreboard")).toContainElement(
    screen.getByTestId("marcador")
  );
  expect(document.querySelector(".game-player-stage")).toContainElement(
    screen.getByTestId("table-scoreboard")
  );
});

test("indica turno propio con chip MANO y resalta al que juega", () => {
  const st = estado1v1({ turn: "Ana", mano: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar", "truco", "irse_al_mazo"], call: null };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByText("MANO")).toBeInTheDocument();
  expect(screen.getByText("TU TURNO")).toBeInTheDocument();
  expect(screen.getByTestId("mi-zona")).toHaveClass("player-own-zone--mano");
});

test("banner de turno muestra '¡Tu turno!' cuando te toca a vos", () => {
  const st = estado1v1({ turn: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar"], call: null };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("turn-banner")).toHaveTextContent("¡Tu turno!");
});

test("banner de turno muestra el nombre del rival cuando no te toca a vos", () => {
  const st = estado1v1({ turn: "Beto" });
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("turn-banner")).toHaveTextContent("Turno de Beto");
});

test("una mesa mixta identifica proveedor y modelo del rival LLM", () => {
  const st = estado1v1();
  st.others[0].agent = { provider: "claude", model: "sonnet" };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("agent-identity-Beto")).toHaveTextContent(
    "Claude · sonnet"
  );
});

test("muestra 'esperando a X' cuando no es tu turno y no hay decisión pendiente", () => {
  const st = estado1v1({ turn: "Beto" });
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("esperando")).toHaveTextContent("Esperando a Beto");
});

test("no muestra banner de turno ni 'esperando' cuando la partida terminó", () => {
  const st = estado1v1({ finished: true, winner: "Equipo 1", turn: null, mano: null });
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.queryByTestId("turn-banner")).not.toBeInTheDocument();
  expect(screen.queryByTestId("esperando")).not.toBeInTheDocument();
});

test("jugar una carta llama a la API y refresca el estado", async () => {
  const user = userEvent.setup();
  const jugado = estado1v1({ turn: "Ana" });
  jugado.you = {
    name: "Ana",
    team: "Equipo 1",
    hand: [
      { palo: "oro", numero: 7 },
      { palo: "espada", numero: 1 },
      { palo: "copa", numero: 12 },
    ],
    played: [],
    pending: { decision: "action", options: ["jugar"], call: null },
  };
  getState.mockResolvedValue(jugado);
  postAction.mockResolvedValue({});
  render(<Table state={jugado} matchId="m1" seat="Ana" />);

  await user.click(screen.getByTestId("carta-espada-1"));
  await waitFor(() =>
    expect(postAction).toHaveBeenCalledWith("m1", {
      player: "Ana",
      action: "play_card",
      card: { palo: "espada", numero: 1 },
      tapada: false,
    })
  );
});

test("jugar boca abajo envía tapada:true y desmarca el checkbox", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ turn: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar"], call: null };
  getState.mockResolvedValue(st);
  postAction.mockResolvedValue({});
  render(<Table state={st} matchId="m1" seat="Ana" />);

  const chk = screen.getByTestId("toggle-tapada").querySelector("input");
  expect(chk).not.toBeChecked();
  await user.click(chk);
  await user.click(screen.getByTestId("carta-oro-7"));
  await waitFor(() =>
    expect(postAction).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ tapada: true })
    )
  );
});

test("oferta de envido con flor disponible muestra ¡Flor! y responde flor", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ call_vigente: "envido", turn: "Ana" });
  st.you.pending = {
    decision: "offer",
    options: ["paso", "envido", "flor"],
    call: null,
  };
  getState.mockResolvedValue(st);
  postAction.mockResolvedValue({});
  render(<Table state={st} matchId="m1" seat="Ana" />);

  const btn = screen.getByTestId("accion-flor");
  expect(btn).toHaveTextContent("¡Flor!");
  await user.click(btn);
  await waitFor(() =>
    expect(postAction).toHaveBeenCalledWith("m1", {
      player: "Ana",
      respond: "flor",
    })
  );
});

test("respuesta a flor ofrece quiero/me_achico/contraflor", () => {
  const st = estado1v1({ call_vigente: "flor", turn: "Beto" });
  st.you.pending = {
    decision: "response",
    options: ["quiero", "no_quiero", "con_flor_quiero", "con_flor_me_achico"],
    call: "flor",
  };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  for (const opt of ["quiero", "no_quiero", "con_flor_quiero", "con_flor_me_achico"]) {
    expect(screen.getByTestId(`accion-${opt}`)).toBeInTheDocument();
  }
  expect(screen.getByTestId("banner-canto")).toHaveTextContent("¡Flor!");
});

test("banner de contraflor al resto", () => {
  const st = estado1v1({ call_vigente: "contraflor_al_resto", turn: "Beto" });
  st.you.pending = {
    decision: "response",
    options: ["quiero", "no_quiero"],
    call: "contraflor_al_resto",
  };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("banner-canto")).toHaveTextContent(
    "Contraflor al resto"
  );
});

test("carta tapada del rival se muestra como dorso sin número", () => {
  const st = estado1v1({ turn: "Beto" });
  st.others[0].played = [{ tapada: true }];
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(document.querySelector(".mini-carta.tapada")).toBeInTheDocument();
});

test("oferta de envido muestra botones Envido/Paso y envía respond", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ call_vigente: "envido", turn: "Ana" });
  st.you.pending = { decision: "offer", options: ["envido", "paso"], call: null };
  getState.mockResolvedValue(st);
  postAction.mockResolvedValue({});
  render(<Table state={st} matchId="m1" seat="Ana" />);

  expect(screen.getByTestId("banner-canto")).toHaveTextContent("Envido");
  await user.click(screen.getByTestId("accion-envido"));
  await waitFor(() =>
    expect(postAction).toHaveBeenCalledWith("m1", {
      player: "Ana",
      respond: "envido",
    })
  );
});

test("respuesta al truco ofrece Quiero/No quiero/escaladas", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ call_vigente: "truco", turn: "Ana" });
  st.you.pending = {
    decision: "response",
    options: ["quiero", "no_quiero", "retruco", "vale_cuatro"],
    call: "truco",
  };
  getState.mockResolvedValue(st);
  postAction.mockResolvedValue({});
  render(<Table state={st} matchId="m1" seat="Ana" />);

  for (const opt of ["quiero", "no_quiero", "retruco", "vale_cuatro"]) {
    expect(screen.getByTestId(`accion-${opt}`)).toBeInTheDocument();
  }
  await user.click(screen.getByTestId("accion-no_quiero"));
  await waitFor(() =>
    expect(postAction).toHaveBeenCalledWith("m1", {
      player: "Ana",
      respond: "no_quiero",
    })
  );
});

test("marcador marca buenas al pasar de 15 en partidas a 30", () => {
  const st = estado1v1();
  st.teams[0].score = 16;
  getState.mockResolvedValue(st);
  render(<Table state={st} matchId="m1" seat="Ana" />);
  const eq = screen.getByTestId("equipo-Equipo 1");
  expect(eq).toHaveTextContent("16");
  expect(eq.querySelector(".puntos")).toHaveClass("buenas");
});

test("fin de partida muestra ganador y revancha", () => {
  const st = estado1v1({ finished: true, winner: "Equipo 1", turn: null, mano: null });
  getState.mockResolvedValue(st);
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("fin-partida")).toHaveTextContent("Ganó Ana");
});

function estado2v2(over = {}) {
  return {
    ...BASE,
    teams: [
      { name: "Nosotros", score: 0, players: ["Ana", "Clara"] },
      { name: "Ellos", score: 0, players: ["Beto", "Dino"] },
    ],
    others: [
      { name: "Beto", team: "Ellos", played: [] },
      { name: "Clara", team: "Nosotros", played: [] },
      { name: "Dino", team: "Ellos", played: [] },
    ],
    you: {
      name: "Ana",
      team: "Nosotros",
      hand: [{ palo: "oro", numero: 7 }],
      played: [],
      pending: null,
      sena_recibida: null,
    },
    ...over,
  };
}

test("enviar seña al compañero llama a postSena con de/para/sena", async () => {
  const user = userEvent.setup();
  const st = estado2v2({ turn: "Beto" });
  render(<Table state={st} matchId="m1" seat="Ana" />);

  await user.click(screen.getByTestId("btn-sena-Clara"));
  expect(screen.getByTestId("paleta-senas")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "guiño" }));
  await waitFor(() =>
    expect(postSena).toHaveBeenCalledWith("m1", {
      de: "Ana",
      para: "Clara",
      sena: "guiño",
    })
  );
});

test("seña recibida muestra toast con emisor y seña", async () => {
  const st = estado2v2({ turn: "Beto" });
  st.you.sena_recibida = { de: "Clara", sena: "lengua" };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  const toast = screen.getByTestId("toast-sena");
  expect(toast).toHaveTextContent("Clara");
  expect(toast).toHaveTextContent("lengua");
});

test("sin compañero no hay botón de seña", () => {
  const st = estado1v1({ turn: "Beto" });
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.queryByTestId(/btn-sena-/)).not.toBeInTheDocument();
});

test("jugada rechazada por el backend (422) muestra un toast de error", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ turn: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar"], call: null };
  const err = Object.assign(new Error("Carta 7 de oro no está en la mano"), {
    status: 422,
  });
  postAction.mockRejectedValue(err);
  render(<Table state={st} matchId="m1" seat="Ana" />);

  await user.click(screen.getByTestId("carta-oro-7"));
  await waitFor(() =>
    expect(screen.getByTestId("toast-error")).toHaveTextContent(
      "Carta 7 de oro no está en la mano"
    )
  );
});

test("fallo de red transitorio (sin status) no muestra toast de error", async () => {
  const user = userEvent.setup();
  const st = estado1v1({ turn: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar"], call: null };
  postAction.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<Table state={st} matchId="m1" seat="Ana" />);

  await user.click(screen.getByTestId("carta-oro-7"));
  await waitFor(() => expect(postAction).toHaveBeenCalled());
  expect(screen.queryByTestId("toast-error")).not.toBeInTheDocument();
});

// -------------------------------------------------- modo paso a paso

function estadoSpectator(over = {}) {
  return {
    ...BASE,
    teams: [
      { name: "Equipo 1", score: 0, players: ["Ana"] },
      { name: "Equipo 2", score: 0, players: ["Beto"] },
    ],
    others: [
      {
        name: "Ana",
        team: "Equipo 1",
        agent: {
          provider: "codex",
          model: "gpt-5.6-sol",
          bluff_level: "mentiroso",
          bluff_scope: "team",
        },
        hand: [
          { palo: "oro", numero: 7 },
          { palo: "espada", numero: 1 },
          { palo: "copa", numero: 12 },
        ],
        played: [],
      },
      {
        name: "Beto",
        team: "Equipo 2",
        agent: {
          provider: "claude",
          model: "sonnet",
          bluff_level: "cauteloso",
          bluff_scope: "team",
        },
        hand: [
          { palo: "basto", numero: 1 },
          { palo: "oro", numero: 6 },
          { palo: "copa", numero: 4 },
        ],
        played: [],
      },
    ],
    you: null,
    pending_step: { player: "Ana", kind: "card" },
    step_generation: 1,
    step_mode: true,
    table_events: [],
    engine_config: { kind: "llm", provider: "codex", model: "gpt-5.6-terra" },
    ...over,
  };
}

test("vista de espectador con pending_step muestra los controles de paso a paso", () => {
  const st = estadoSpectator();
  render(<Table state={st} matchId="m1" seat={null} />);
  expect(screen.getByTestId("step-controls")).toBeInTheDocument();
  expect(screen.getByTestId("step-controls")).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByTestId("step-controls")).not.toHaveTextContent("Próxima movida");
  expect(screen.getByTestId("auto-play")).toBeChecked();
  expect(screen.getByTestId("spectator-hand-Ana").children).toHaveLength(3);
  expect(screen.getByTestId("spectator-hand-Beto").children).toHaveLength(3);
  expect(screen.getByTestId("played-zone-Ana")).toBeInTheDocument();
  expect(screen.getAllByTestId(/played-placeholder-Ana-/)).toHaveLength(1);
  expect(screen.queryByTestId("slot-Ana")).not.toBeInTheDocument();
  expect(screen.getByText("Jugador · Ana")).toBeInTheDocument();
  expect(screen.getByText("Jugador · Beto")).toBeInTheDocument();
  expect(screen.queryByText("Equipo 1")).not.toBeInTheDocument();
  expect(screen.queryByText("Equipo 2")).not.toBeInTheDocument();
  expect(screen.getByTestId("agent-identity-Ana")).toHaveTextContent(
    "Codex · gpt-5.6-sol"
  );
  expect(screen.getByTestId("agent-identity-Beto")).toHaveTextContent(
    "Claude · sonnet"
  );
  expect(screen.getByTestId("picardia-Ana")).toHaveTextContent(
    "Picardía · Mentiroso"
  );
  expect(screen.getByTestId("picardia-Beto")).toHaveTextContent(
    "Picardía · Cauteloso"
  );
  expect(screen.getByTestId("engine-llm-identity")).toHaveTextContent(
    "Codex · gpt-5.6-terra"
  );
});

test("mantiene fija la identidad real del motor ante snapshots transitorios", async () => {
  const initial = estadoSpectator({
    engine_config: { kind: "llm", provider: "codex", model: null },
  });
  const transient = estadoSpectator({
    pending_step: null,
    engine_config: undefined,
  });
  const { rerender } = render(<Table state={initial} matchId="m1" seat={null} />);

  expect(screen.getByTestId("engine-llm-identity")).toHaveTextContent(
    "Motor de reglas · Codex"
  );
  expect(screen.getByTestId("engine-llm-identity")).not.toHaveTextContent(
    "modelo predeterminado"
  );

  rerender(<Table state={transient} matchId="m1" seat={null} />);

  await waitFor(() => expect(screen.getByTestId("engine-llm-identity")).toHaveTextContent(
    "Motor de reglas · Codex"
  ));
});

test("grafica las fases de mezcla y reparto dentro del paño", async () => {
  vi.useFakeTimers();
  try {
    render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

    expect(screen.getByTestId("deal-sequence")).toHaveTextContent("Mezclando el mazo");
    expect(screen.getAllByLabelText("Carta boca abajo")).toHaveLength(4);
    expect(screen.getAllByTestId(/spectator-card-/)).toHaveLength(6);

    await act(async () => { await vi.advanceTimersByTimeAsync(480); });
    expect(screen.getByTestId("deal-sequence")).toHaveTextContent("Repartiendo cartas");
    expect(screen.getAllByLabelText("Carta boca abajo")).toHaveLength(6);

    await act(async () => { await vi.advanceTimersByTimeAsync(770); });
    expect(screen.queryByTestId("deal-sequence")).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("vuelve a mezclar y repartir cuando comienza otra mano", async () => {
  vi.useFakeTimers();
  try {
    const firstHand = estadoSpectator();
    firstHand.others[0].played = [{ palo: "oro", numero: 7 }];
    firstHand.others[1].played = [{ palo: "copa", numero: 4 }];
    const nextHand = estadoSpectator({ mano: "Ana", step_generation: 4 });
    const { rerender } = render(
      <Table state={firstHand} matchId="m1" seat={null} />
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(1250); });
    expect(screen.queryByTestId("deal-sequence")).not.toBeInTheDocument();

    rerender(<Table state={nextHand} matchId="m1" seat={null} />);
    await act(async () => {});

    expect(screen.getByTestId("deal-sequence")).toHaveTextContent(
      "Mezclando el mazo"
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(480); });
    expect(screen.getByTestId("deal-sequence")).toHaveTextContent(
      "Repartiendo cartas"
    );
  } finally {
    vi.useRealTimers();
  }
});

test("permite activar el sonido accesible de mezcla y reparto", async () => {
  const user = userEvent.setup();
  localStorage.removeItem("truco:table-sound");
  playTableSound.mockClear();
  render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

  const toggle = screen.getByTestId("table-sound-toggle");
  expect(toggle).toHaveAttribute("aria-pressed", "false");

  await user.click(toggle);

  expect(toggle).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(playTableSound).toHaveBeenCalledWith("shuffle"));
  expect(localStorage.getItem("truco:table-sound")).toBe("1");

  await user.click(toggle);
});

test("mantiene visible el canto LLM y su respuesta durante Preparando jugada", async () => {
  const live = estadoSpectator({
    call_vigente: "truco",
    table_events: [
      { id: 1, type: "call", player: "Ana", call: "truco" },
    ],
    pending_step: { player: "Beto", kind: "response", call: "truco" },
  });
  const preparing = estadoSpectator({
    call_vigente: null,
    table_events: [
      { id: 1, type: "call", player: "Ana", call: "truco" },
      { id: 2, type: "call_response", player: "Beto", call: "truco", response: "quiero" },
    ],
    pending_step: null,
    step_generation: 2,
  });
  const { rerender } = render(<Table state={live} matchId="m1" seat={null} />);
  fireEvent.click(screen.getByTestId("auto-play"));

  const chat = screen.getByTestId("table-call-chat");
  expect(screen.getAllByTestId("table-call-chat")).toHaveLength(1);
  expect(screen.getByTestId("call-typing-Beto")).toHaveTextContent("Beto está pensando");
  expect(within(chat).getByText("¡Truco!")).toBeInTheDocument();

  rerender(<Table state={preparing} matchId="m1" seat={null} />);
  await waitFor(() => expect(screen.getByTestId("table-wait-status")).toHaveTextContent(
    "Preparando jugada"
  ));
  expect(within(chat).getByText("¡Truco!")).toBeInTheDocument();
  expect(within(chat).getByText("cantó")).toBeInTheDocument();
  expect(within(chat).getByText("Quiero")).toBeInTheDocument();
  expect(within(chat).getByText("respondió a Truco")).toBeInTheDocument();
  expect(screen.getByTestId("call-announcement-table")).toHaveAttribute("role", "log");
});

test("presenta los cantos como una conversación alineada por jugador", () => {
  const state = estadoSpectator({
    table_events: [
      { id: 1, type: "call", player: "Ana", call: "envido" },
      { id: 2, type: "call", player: "Beto", call: "real_envido", responds_to: "envido" },
      { id: 3, type: "call", player: "Ana", call: "falta_envido", responds_to: "real_envido" },
      { id: 4, type: "call_response", player: "Beto", call: "falta_envido", response: "quiero" },
    ],
  });
  render(<Table state={state} matchId="m1" seat={null} />);

  const chat = screen.getByTestId("table-call-chat");
  const messages = screen.getAllByTestId(/call-chat-message-/);

  expect(screen.getAllByTestId("table-call-chat")).toHaveLength(1);
  expect(screen.getByTestId("call-announcement-table")).toHaveAttribute("role", "log");
  expect(screen.getAllByTestId(/call-chat-message-/)).toHaveLength(4);
  expect(messages.map((message) => message.dataset.testid)).toEqual([
    "call-chat-message-1",
    "call-chat-message-2",
    "call-chat-message-3",
    "call-chat-message-4",
  ]);
  expect(screen.getByTestId("call-chat-message-1")).toHaveClass(
    "table-call-chat__bubble--left",
    "table-call-chat__bubble--teal"
  );
  expect(screen.getByTestId("call-chat-message-2")).toHaveClass(
    "table-call-chat__bubble--right",
    "table-call-chat__bubble--violet"
  );
  expect(screen.getByTestId("call-chat-message-3")).toHaveClass(
    "table-call-chat__bubble--left",
    "table-call-chat__bubble--teal"
  );
  expect(screen.getByTestId("call-chat-message-4")).toHaveClass(
    "table-call-chat__bubble--right",
    "table-call-chat__bubble--violet"
  );
  expect(screen.getByTestId("spectator-player-Ana")).toHaveClass("spectator-player-panel");
  expect(screen.getByTestId("spectator-player-Beto")).toHaveClass("spectator-player-panel");
  expect(screen.getByTestId("spectator-player-Ana").parentElement).toHaveClass(
    "spectator-player-cluster--top"
  );
  expect(screen.getByTestId("spectator-player-Beto").parentElement).toHaveClass(
    "spectator-player-cluster--bottom"
  );
  expect(chat.parentElement).toBe(screen.getByTestId("spectator-middle"));
  expect(screen.getByTestId("spectator-trick").parentElement).toBe(chat.parentElement);
  expect(screen.getByTestId("call-chat-message-3")).toHaveTextContent("Falta Envido");
  expect(within(screen.getByTestId("call-chat-message-4")).getByText("Quiero")).toBeInTheDocument();
  expect(within(screen.getByTestId("call-chat-message-4")).getByText("respondió a Falta Envido")).toBeInTheDocument();
});

test("explica explícitamente cuando todavía no hubo cantos", () => {
  render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

  expect(screen.getAllByTestId("table-call-chat")).toHaveLength(1);
  expect(screen.getByTestId("no-call-status-table")).toHaveTextContent("Todavía no hubo cantos");
  expect(screen.queryByTestId("legacy-events-warning")).not.toBeInTheDocument();
});

test("avisa cuando la mesa está conectada a un backend antiguo sin eventos", () => {
  const legacy = estadoSpectator();
  delete legacy.table_events;
  render(<Table state={legacy} matchId="m1" seat={null} />);

  expect(screen.getByTestId("legacy-events-warning")).toHaveTextContent(
    "Servidor sin registro de cantos"
  );
});

test("un snapshot transitorio vacío no borra las imágenes de las cartas", async () => {
  const stable = estadoSpectator();
  const transient = estadoSpectator({
    pending_step: null,
    step_generation: 2,
    others: stable.others.map((player) => ({ ...player, hand: [] })),
  });
  const { rerender } = render(<Table state={stable} matchId="m1" seat={null} />);
  fireEvent.click(screen.getByTestId("auto-play"));

  expect(screen.getAllByTestId(/spectator-card-/)).toHaveLength(6);
  rerender(<Table state={transient} matchId="m1" seat={null} />);

  await waitFor(() => expect(screen.getAllByTestId(/spectator-card-/)).toHaveLength(6));
  expect(screen.getByTestId("table-wait-status")).toHaveTextContent("Preparando jugada");
});

test("reserva tres lugares de carta para que el puesto y el paño no cambien de tamaño", () => {
  const state = estadoSpectator();
  state.others[0].hand = [{ palo: "oro", numero: 7 }];
  state.others[1].hand = [];
  render(<Table state={state} matchId="m1" seat={null} />);

  expect(screen.getByTestId("spectator-player-Ana")).toHaveClass(
    "spectator-player-card"
  );
  expect(screen.getByTestId("spectator-hand-Ana")).toHaveClass("spectator-hand");
  expect(screen.getAllByTestId(/spectator-hand-placeholder-Ana-/)).toHaveLength(2);
  expect(screen.getAllByTestId(/spectator-hand-placeholder-Beto-/)).toHaveLength(3);
  expect(screen.getByText("Beto ya no tiene cartas en la mano")).toHaveClass("sr-only");
});

test("mantiene estables los paneles con nombres y modelos largos", () => {
  const longName = "Agente estratega del litoral con un nombre extraordinariamente largo";
  const longModel = "nemotron-3-ultra-free-experimental-context-window-extended";
  const state = estadoSpectator({
    teams: [
      { name: "Equipo 1", score: 0, players: [longName] },
      { name: "Equipo 2", score: 0, players: ["Beto"] },
    ],
    mano: longName,
    turn: longName,
    pending_step: { player: longName, kind: "card" },
  });
  state.others[0] = {
    ...state.others[0],
    name: longName,
    agent: {
      ...state.others[0].agent,
      provider: "opencode",
      model: longModel,
    },
  };

  render(<Table state={state} matchId="m1" seat={null} />);

  expect(screen.getByTestId(`spectator-player-${longName}`)).toHaveClass(
    "spectator-player-card"
  );
  expect(screen.getByTestId(`spectator-player-name-${longName}`)).toHaveClass(
    "spectator-player-name",
    "truncate"
  );
  expect(screen.getByTestId(`spectator-player-name-${longName}`)).toHaveAttribute(
    "title",
    longName
  );
  expect(screen.getByTestId("spectator-team-label-Equipo 1")).toHaveClass("truncate");
  expect(screen.getByTestId("spectator-team-label-Equipo 1")).toHaveAttribute(
    "title",
    `Jugador · ${longName}`
  );
  expect(screen.getByTestId(`agent-identity-${longName}`)).toHaveClass("truncate");
  expect(screen.getByTestId(`agent-identity-${longName}`).parentElement).toHaveClass(
    "flex-nowrap",
    "overflow-hidden"
  );
  expect(
    screen.getByTestId(`spectator-player-${longName}`).querySelector(".spectator-player-agent")
  ).toBeInTheDocument();
  expect(screen.getByTestId(`agent-identity-${longName}`)).toHaveAttribute(
    "title",
    `OpenCode · ${longModel}`
  );
});

test("el marcador usa el panel ampliado sin perder nombres largos", () => {
  const longTeamName = "La escuadra federal de campeones del litoral";
  const state = estado1v1({
    teams: [
      { name: longTeamName, score: 14, players: [longTeamName] },
      { name: "Rivales", score: 12, players: ["Rivales"] },
    ],
  });

  render(<Table state={state} matchId="m1" seat="Ana" />);

  expect(screen.getByTestId("marcador")).toHaveClass("max-w-2xl", "px-4", "py-3");
  expect(screen.getByTestId(`equipo-${longTeamName}`).querySelector(".nombre")).toHaveAttribute(
    "title",
    longTeamName
  );
});

test("pantalla y arena de espectador comparten el shell centrado", () => {
  render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

  expect(screen.getByTestId("mesa")).toHaveClass("game-screen");
  expect(screen.getByTestId("spectator-arena")).toHaveClass("game-shell");
  expect(screen.getByTestId("spectator-felt")).toHaveClass("spectator-felt");
  expect(screen.getByTestId("spectator-felt")).toContainElement(
    screen.getByTestId("table-scoreboard")
  );
  expect(screen.queryByTestId("mazo")).not.toBeInTheDocument();
});

test("marca con un recuadro dorado al participante que tiene la mano", () => {
  render(<Table state={estadoSpectator({ mano: "Ana", turn: "Beto" })} matchId="m1" seat={null} />);

  expect(screen.getByTestId("spectator-player-Ana")).toHaveClass(
    "spectator-player-card--mano"
  );
  expect(screen.getByTestId("spectator-player-Beto")).not.toHaveClass(
    "spectator-player-card--mano"
  );
});

test("la mesa de un jugador también usa el shell central", () => {
  render(<Table state={estado1v1()} matchId="m1" seat="Ana" />);
  expect(document.querySelector(".game-player-stage")).toHaveClass("game-shell");
});

test("la apertura de la mesa muestra un spinner de espera", () => {
  getState.mockReturnValue(new Promise(() => {}));

  render(<Mesa matchId="m1" />);

  expect(screen.getByText("Abriendo la mesa…")).toHaveAttribute("role", "status");
  expect(screen.getByTestId("opening-wait-spinner")).toBeInTheDocument();
});

test("la reconexión de la mesa muestra un spinner de espera", async () => {
  getState.mockRejectedValue(new Error("red caída"));

  render(<Mesa matchId="m1" />);

  expect(await screen.findByTestId("conn-error")).toHaveTextContent("Reintentando");
  expect(screen.getByTestId("retry-wait-spinner")).toBeInTheDocument();
});

test("una partida marcada como espectador salta la elección de asiento", async () => {
  localStorage.setItem(spectatorKey("m1"), "1");
  getState.mockResolvedValue(estadoSpectator());

  render(<Mesa matchId="m1" />);

  expect(await screen.findByTestId("spectator-arena")).toBeInTheDocument();
  expect(screen.queryByText("Elegí tu asiento")).not.toBeInTheDocument();
  expect(getState).toHaveBeenCalledWith("m1", undefined, true);
});

test("recupera las manos desde cada jugador si la API de espectador es anterior", async () => {
  localStorage.setItem(spectatorKey("m1"), "1");
  const legacy = estadoSpectator();
  legacy.others = legacy.others.map(({ hand: _hand, ...player }) => player);
  getState
    .mockResolvedValueOnce(legacy)
    .mockResolvedValueOnce({
      you: { name: "Ana", hand: [{ palo: "oro", numero: 7 }] },
    })
    .mockResolvedValueOnce({
      you: { name: "Beto", hand: [{ palo: "copa", numero: 4 }] },
    });

  render(<Mesa matchId="m1" />);

  expect(await screen.findByTestId("spectator-card-Ana-0")).toBeInTheDocument();
  expect(screen.getByTestId("spectator-card-Beto-0")).toBeInTheDocument();
  expect(getState).toHaveBeenNthCalledWith(1, "m1", undefined, true);
  expect(getState).toHaveBeenNthCalledWith(2, "m1", "Ana");
  expect(getState).toHaveBeenNthCalledWith(3, "m1", "Beto");
});

test("recupera proveedor y modelo guardados si el snapshot todavía no los expone", async () => {
  localStorage.setItem(spectatorKey("m1"), "1");
  localStorage.setItem(matchConfigKey("m1"), JSON.stringify({
    engine: "llm",
    engine_provider: "codex",
    engine_model: "gpt-5.6-terra",
    players: [
      { name: "Ana", kind: "agent", provider: "codex", model: "gpt-5.6-sol" },
      { name: "Beto", kind: "agent", provider: "claude", model: "sonnet" },
    ],
  }));
  const legacy = estadoSpectator();
  legacy.others = legacy.others.map(({ agent: _agent, ...player }) => player);
  delete legacy.engine_config;
  getState.mockResolvedValue(legacy);

  render(<Mesa matchId="m1" />);

  expect(await screen.findByTestId("agent-identity-Ana")).toHaveTextContent(
    "LLM · Codex · gpt-5.6-sol"
  );
  expect(screen.getByTestId("agent-identity-Beto")).toHaveTextContent(
    "LLM · Claude · sonnet"
  );
  expect(screen.getByTestId("engine-llm-identity")).toHaveTextContent(
    "Codex · gpt-5.6-terra"
  );
});

test("no inyecta proveedor ni modelo desde la última partida global", async () => {
  localStorage.setItem(spectatorKey("m1"), "1");
  localStorage.removeItem(matchConfigKey("m1"));
  localStorage.setItem("truco:lastConfig", JSON.stringify({
    engine: "llm",
    engine_provider: "codex",
    engine_model: "modelo-ajeno",
    players: [
      { name: "Ana", kind: "agent", provider: "codex", model: "agente-ajeno" },
      { name: "Beto", kind: "agent", provider: "codex", model: "agente-ajeno" },
    ],
  }));
  const legacy = estadoSpectator();
  legacy.others = legacy.others.map(({ agent: _agent, ...player }) => player);
  delete legacy.engine_config;
  getState.mockResolvedValue(legacy);

  render(<Mesa matchId="m1" />);

  expect(await screen.findByTestId("spectator-arena")).toBeInTheDocument();
  expect(screen.queryByTestId("engine-llm-identity")).not.toBeInTheDocument();
  expect(screen.queryByText("modelo-ajeno")).not.toBeInTheDocument();
  expect(screen.queryByText("agente-ajeno")).not.toBeInTheDocument();
});

test("sin pending_step mantiene los controles y deshabilita siguiente", () => {
  const st = estadoSpectator({ pending_step: null });
  render(<Table state={st} matchId="m1" seat={null} />);
  expect(screen.getByTestId("step-controls")).toBeInTheDocument();
  expect(screen.getByTestId("step-controls")).not.toHaveTextContent(
    "Preparando la próxima movida"
  );
  expect(screen.getByTestId("step-controls")).toHaveClass("step-controls--collapsed");
  expect(screen.getByTestId("siguiente-movida")).toBeDisabled();
  expect(screen.getByTestId("step-wait-spinner")).toBeInTheDocument();
  expect(screen.getByTestId("table-wait-status")).toHaveTextContent(
    "Preparando jugada"
  );
  expect(screen.getByTestId("table-wait-status")).toHaveClass(
    "top-2"
  );
});

test("el refresco entre pasos conserva el mismo bloque y botón", async () => {
  const first = estadoSpectator();
  const { rerender } = render(<Table state={first} matchId="m1" seat={null} />);
  const controls = screen.getByTestId("step-controls");
  const button = screen.getByTestId("siguiente-movida");
  const trick = screen.getByTestId("spectator-trick");

  rerender(
    <Table
      state={estadoSpectator({ pending_step: null, step_generation: 2, turn: null })}
      matchId="m1"
      seat={null}
    />
  );

  await waitFor(() => expect(controls).not.toHaveTextContent("Preparando la próxima movida"));
  expect(screen.getByTestId("step-controls")).toBe(controls);
  expect(screen.getByTestId("siguiente-movida")).toBe(button);
  expect(button).toBeDisabled();
  expect(screen.getByTestId("spectator-trick")).toBe(trick);
  expect(screen.getByTestId("table-wait-status")).toHaveTextContent(
    "Preparando jugada"
  );
  expect(screen.queryByTestId("turn-status-slot")).not.toBeInTheDocument();
  expect(screen.getByTestId("step-wait-spinner")).toBeInTheDocument();
});

test("muestra spinner y conserva el botón mientras resuelve una jugada", async () => {
  const user = userEvent.setup();
  let resolveStep;
  postStep.mockReturnValue(new Promise((resolve) => { resolveStep = resolve; }));
  render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

  const button = screen.getByTestId("siguiente-movida");
  await user.click(button);

  expect(screen.getByTestId("step-controls")).not.toHaveTextContent("Resolviendo la jugada");
  expect(screen.getByTestId("step-controls")).toHaveClass("step-controls--collapsed");
  expect(screen.getByTestId("table-wait-status")).toHaveTextContent(
    "Resolviendo jugada"
  );
  expect(screen.getByTestId("step-wait-spinner")).toBeInTheDocument();
  expect(button).toBeDisabled();

  await act(async () => {
    resolveStep(estadoSpectator({ pending_step: null, turn: null }));
  });
});

test("muestra la recuperación de la mano dentro de la baza", () => {
  render(
    <Table
      state={estadoSpectator({
        pending_step: null,
        turn: null,
        recovering: true,
        recovery_error: "RuntimeError: transitorio",
      })}
      matchId="m1"
      seat={null}
    />
  );

  expect(screen.getByTestId("table-wait-status")).toHaveTextContent(
    "Recuperando la mano"
  );
  expect(screen.queryByTestId("turn-status-slot")).not.toBeInTheDocument();
});

test("el dock se expande sólo al pasar de autoplay a control manual", async () => {
  const user = userEvent.setup();
  render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

  const controls = screen.getByTestId("step-controls");
  expect(controls).toHaveAttribute("data-collapsed", "true");

  await user.click(screen.getByTestId("auto-play"));

  expect(controls).toHaveAttribute("data-collapsed", "false");
  expect(controls).toHaveTextContent("Próxima movida");
  expect(controls).toHaveTextContent("Ana");
});

test("click en 'Siguiente movida' llama a postStep y refresca el estado", async () => {
  const user = userEvent.setup();
  const st = estadoSpectator();
  const after = estadoSpectator({ pending_step: { player: "Beto", kind: "action" } });
  postStep.mockResolvedValue(after);
  render(<Table state={st} matchId="m1" seat={null} />);

  await user.click(screen.getByTestId("siguiente-movida"));
  expect(screen.getByTestId("auto-play")).not.toBeChecked();
  await waitFor(() => expect(postStep).toHaveBeenCalledWith("m1", "manual"));
  await waitFor(() =>
    expect(within(screen.getByTestId("step-controls")).getByText(/Beto/)).toBeInTheDocument()
  );
});

test("auto-play llama a postStep automáticamente tras el delay elegido", async () => {
  vi.useFakeTimers();
  try {
    const st = estadoSpectator();
    postStep.mockClear();
    postStep.mockResolvedValue(estadoSpectator({ pending_step: null }));
    render(<Table state={st} matchId="m1" seat={null} />);

    fireEvent.change(screen.getByTestId("auto-play-delay"), { target: { value: "1000" } });

    expect(postStep).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(postStep).toHaveBeenCalledWith("m1", "autoplay");
  } finally {
    vi.useRealTimers();
  }
});

test("auto-play procesa rápido las decisiones internas antes de la carta", async () => {
  vi.useFakeTimers();
  try {
    const st = estadoSpectator({
      pending_step: { player: "Ana", kind: "action" },
    });
    postStep.mockClear();
    postStep.mockResolvedValue(estadoSpectator({
      pending_step: { player: "Ana", kind: "card" },
      step_generation: 2,
    }));
    render(<Table state={st} matchId="m1" seat={null} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(postStep).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(postStep).toHaveBeenCalledWith("m1", "autoplay");
  } finally {
    vi.useRealTimers();
  }
});

test("auto-play continúa con pasos consecutivos del mismo jugador y tipo", async () => {
  vi.useFakeTimers();
  try {
    const first = estadoSpectator({ step_generation: 10 });
    const second = estadoSpectator({ step_generation: 11 });
    const third = estadoSpectator({ step_generation: 12, pending_step: null });
    postStep.mockReset();
    postStep.mockResolvedValueOnce(second).mockResolvedValueOnce(third);
    render(<Table state={first} matchId="m1" seat={null} />);

    fireEvent.change(screen.getByTestId("auto-play-delay"), { target: { value: "1000" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(postStep).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(postStep).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("auto-play se pausa y explica un fallo al avanzar", async () => {
  vi.useFakeTimers();
  try {
    postStep.mockReset();
    postStep.mockRejectedValue(new Error("backend no disponible"));
    render(<Table state={estadoSpectator()} matchId="m1" seat={null} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(postStep).toHaveBeenCalledWith("m1", "autoplay");
    expect(screen.getByTestId("auto-play")).not.toBeChecked();
    expect(screen.getByTestId("toast-error")).toHaveTextContent(
      "backend no disponible"
    );
    expect(screen.getByTestId("spectator-status")).toHaveTextContent("Pausado");
  } finally {
    vi.useRealTimers();
  }
});

test("hace visible una decisión de fallback del agente", () => {
  render(
    <Table
      state={estadoSpectator({
        last_agent_decision: {
          id: 4,
          type: "agent_decision",
          player: "Ana",
          kind: "response",
          choice: "no_quiero",
          source: "fallback",
          reason: "respuesta no parseable",
        },
      })}
      matchId="m1"
      seat={null}
    />
  );

  expect(screen.getByTestId("agent-fallback-status")).toHaveTextContent(
    "Fallback legal · Ana"
  );
});

test("bazas de la mesa se muestran también en vista de espectador", () => {
  const st = estadoSpectator();
  st.others[0].played = [{ palo: "oro", numero: 7 }];
  render(<Table state={st} matchId="m1" seat={null} />);
  expect(screen.getByTestId("spectator-felt")).toBeInTheDocument();
  expect(screen.getByTestId("spectator-trick")).toBeInTheDocument();
  expect(screen.getByTestId("played-card-Ana-0")).toHaveTextContent("7");
  expect(screen.queryAllByTestId(/played-placeholder-Ana-/)).toHaveLength(0);
  expect(document.querySelector(".mini-carta")).toBeInTheDocument();
});

test("la carta viaja desde la mano del jugador hasta su lugar en la baza", async () => {
  vi.useFakeTimers();
  try {
    localStorage.setItem("truco:table-sound", "1");
    playTableSound.mockClear();
    const initial = estadoSpectator({ mano: null });
    const after = estadoSpectator({ mano: null, step_generation: 2 });
    after.others[0].hand = after.others[0].hand.slice(1);
    after.others[0].played = [{ palo: "oro", numero: 7 }];
    const { rerender } = render(<Table state={initial} matchId="m1" seat={null} />);

    rerender(<Table state={after} matchId="m1" seat={null} />);
    await act(async () => {});

    expect(screen.getByTestId("card-flight-Ana")).toHaveTextContent(
      "Ana jugó 7 de oro"
    );
    expect(screen.getByTestId("played-card-Ana-0")).toHaveClass(
      "trick-card--receiving"
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(620); });

    expect(screen.queryByTestId("card-flight-Ana")).not.toBeInTheDocument();
    expect(screen.getByTestId("played-card-Ana-0")).not.toHaveClass(
      "trick-card--receiving"
    );
    expect(playTableSound).toHaveBeenCalledWith("card");
  } finally {
    vi.useRealTimers();
  }
});

test("la baza conserva el historial de cartas con una pila compacta", () => {
  const st = estadoSpectator();
  st.others[0].played = [
    { palo: "oro", numero: 7 },
    { palo: "espada", numero: 1 },
  ];
  st.others[1].played = [{ palo: "copa", numero: 4 }];

  render(<Table state={st} matchId="m1" seat={null} />);

  expect(screen.getByTestId("spectator-trick")).toHaveTextContent("2.ª");
  expect(screen.getByTestId("played-card-Ana-0")).toHaveTextContent("7");
  expect(screen.getByTestId("played-card-Ana-1")).toHaveTextContent("1");
  expect(screen.getByTestId("played-stack-Ana")).toHaveClass(
    "trick-card-stack--stacked"
  );
  expect(screen.getByTestId("played-card-layer-Ana-0")).toHaveStyle({
    "--stack-index": "0",
    "--stack-size": "2",
  });
  expect(screen.getByTestId("played-card-layer-Ana-1")).toHaveStyle({
    "--stack-index": "1",
    "--stack-size": "2",
  });
  expect(screen.getByTestId("played-card-Beto-0")).toHaveTextContent("4");
  expect(screen.getByTestId("played-stack-Beto")).toHaveClass(
    "trick-card-stack--single"
  );
});
