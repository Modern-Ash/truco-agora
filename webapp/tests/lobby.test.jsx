import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Lobby from "../src/Lobby.jsx";
import { createMatch } from "../src/api.js";

vi.mock("../src/api.js", () => ({
  createMatch: vi.fn(),
}));

test("lobby renderiza elección de modalidad y objetivo", () => {
  render(<Lobby />);
  expect(screen.getByTestId("mode-1v1")).toBeInTheDocument();
  expect(screen.getByTestId("mode-2v2")).toBeInTheDocument();
  expect(screen.getByTestId("target-15")).toBeInTheDocument();
  expect(screen.getByTestId("target-30")).toBeInTheDocument();
  expect(screen.getByTestId("seat-0")).toHaveValue("Jugador 1");
});

test("cambiar a 2v2 muestra cuatro asientos", async () => {
  const user = userEvent.setup();
  render(<Lobby />);
  await user.click(screen.getByTestId("mode-2v2"));
  for (let i = 0; i < 4; i++) {
    expect(screen.getByTestId(`seat-${i}`)).toBeInTheDocument();
  }
});

test("crear partida llama a la API con la configuración elegida", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "abc123" });
  const onCreated = vi.fn();
  render(<Lobby onCreated={onCreated} />);

  await user.click(screen.getByTestId("target-30"));
  await user.clear(screen.getByTestId("seat-0"));
  await user.type(screen.getByTestId("seat-0"), "Fede");
  await user.click(screen.getByTestId("crear"));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith("abc123"));
  expect(createMatch).toHaveBeenCalledWith({
    mode: "1v1",
    target_score: 30,
    players: [{ name: "Fede" }, { name: "Jugador 2" }],
    seed: null,
  });
});
