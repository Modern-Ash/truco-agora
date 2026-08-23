import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Table from "../src/components/Table.jsx";
import { getState, postAction, postSena } from "../src/api.js";

vi.mock("../src/api.js", () => ({
  getState: vi.fn(),
  postAction: vi.fn(),
  postSena: vi.fn(),
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

test("mesa muestra mano propia, rival, mazo y marcador", () => {
  getState.mockResolvedValue(estado1v1());
  render(<Table state={estado1v1()} matchId="m1" seat="Ana" />);
  expect(screen.getByTestId("carta-oro-7")).toBeInTheDocument();
  expect(screen.getByTestId("carta-espada-1")).toBeInTheDocument();
  expect(screen.getByTestId("slot-Beto")).toBeInTheDocument();
  expect(screen.getByTestId("mazo")).toBeInTheDocument();
  expect(screen.getByTestId("equipo-Equipo 1")).toHaveTextContent("4");
});

test("indica turno propio con chip MANO y resalta al que juega", () => {
  const st = estado1v1({ turn: "Ana", mano: "Ana" });
  st.you.pending = { decision: "action", options: ["jugar", "truco", "irse_al_mazo"], call: null };
  render(<Table state={st} matchId="m1" seat="Ana" />);
  expect(screen.getByText("MANO")).toBeInTheDocument();
  expect(screen.getByText("TU TURNO")).toBeInTheDocument();
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
  expect(screen.getByTestId("fin-partida")).toHaveTextContent("Ganó Equipo 1");
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
