import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Table from "../src/components/Table.jsx";
import { getState, postAction } from "../src/api.js";

vi.mock("../src/api.js", () => ({
  getState: vi.fn(),
  postAction: vi.fn(),
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
    })
  );
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
