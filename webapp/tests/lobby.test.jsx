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
    players: [
      { name: "Fede", kind: "web" },
      { name: "Jugador 2", kind: "web" },
    ],
    engine: "llm",
    engine_provider: "mock",
    engine_model: undefined,
    seed: null,
  });
});

// -------------------------------------------------- motor de reglas (engine)

test("motor LLM es el default y muestra selector de proveedor", () => {
  render(<Lobby />);
  expect(screen.getByTestId("engine-llm")).toHaveClass("on");
  expect(screen.getByTestId("engine-config")).toBeInTheDocument();
  expect(screen.getByTestId("engine-provider")).toHaveValue("mock");
});

test("elegir motor determinista oculta la config de proveedor", async () => {
  const user = userEvent.setup();
  render(<Lobby />);
  await user.click(screen.getByTestId("engine-deterministic"));
  expect(screen.getByTestId("engine-deterministic")).toHaveClass("on");
  expect(screen.queryByTestId("engine-config")).not.toBeInTheDocument();
});

test("elegir proveedor y modelo del motor se envía en createMatch", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "xyz" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.selectOptions(screen.getByTestId("engine-provider"), "ollama");
  await user.type(screen.getByTestId("engine-model"), "qwen2.5:7b");
  await user.click(screen.getByTestId("crear"));

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "llm",
        engine_provider: "ollama",
        engine_model: "qwen2.5:7b",
      })
    )
  );
});

// ------------------------------------------------------- asientos (kind)

test("cada asiento es humano por defecto y no muestra config de agente", () => {
  render(<Lobby />);
  expect(screen.getByTestId("seat-0-kind-web")).toHaveClass("on");
  expect(screen.queryByTestId("seat-0-agent-config")).not.toBeInTheDocument();
});

test("marcar un asiento como agente muestra proveedor/modelo y se envía kind agent", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "abc" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("seat-1-kind-agent"));
  expect(screen.getByTestId("seat-1-agent-config")).toBeInTheDocument();
  await user.selectOptions(screen.getByTestId("seat-1-provider"), "opencode");

  await user.click(screen.getByTestId("crear"));
  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        players: [
          { name: "Jugador 1", kind: "web" },
          { name: "Jugador 2", kind: "agent", provider: "opencode", model: undefined },
        ],
      })
    )
  );
});
