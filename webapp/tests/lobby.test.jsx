import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Lobby from "../src/Lobby.jsx";
import { createMatch } from "../src/api.js";
import { NOMBRES_EQUIPOS, NOMBRES_HUMANOS, NOMBRES_AGENTES } from "../src/names.js";

vi.mock("../src/api.js", () => ({
  createMatch: vi.fn(),
}));

// Nombres por defecto (equipo/jugador) se eligen al azar; se fija
// Math.random en 0 para que cada elección sea el primer elemento
// disponible del pool y las pruebas sean deterministas.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  Math.random.mockRestore();
});

test("lobby renderiza elección de modalidad y objetivo", () => {
  render(<Lobby />);
  expect(screen.getByTestId("mode-1v1")).toBeInTheDocument();
  expect(screen.getByTestId("mode-2v2")).toBeInTheDocument();
  expect(screen.getByTestId("target-15")).toBeInTheDocument();
  expect(screen.getByTestId("target-30")).toBeInTheDocument();
  expect(screen.getByTestId("seat-0")).toHaveValue(NOMBRES_HUMANOS[0]);
});

test("cada asiento arranca con un nombre humano distinto de un pool por defecto", () => {
  render(<Lobby />);
  expect(screen.getByTestId("seat-0")).toHaveValue(NOMBRES_HUMANOS[0]);
  expect(screen.getByTestId("seat-1")).toHaveValue(NOMBRES_HUMANOS[1]);
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
      { name: NOMBRES_HUMANOS[1], kind: "web" },
    ],
    engine: "llm",
    engine_provider: "mock",
    engine_model: undefined,
    step_mode: false,
    seed: null,
    team_names: [NOMBRES_EQUIPOS[0], NOMBRES_EQUIPOS[1]],
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
          { name: NOMBRES_HUMANOS[0], kind: "web" },
          { name: NOMBRES_AGENTES[0], kind: "agent", provider: "opencode", model: undefined },
        ],
      })
    )
  );
});

test("un nombre editado a mano no se pierde al cambiar el tipo de asiento", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  await user.clear(screen.getByTestId("seat-1"));
  await user.type(screen.getByTestId("seat-1"), "Robotina");
  await user.click(screen.getByTestId("seat-1-kind-agent"));

  expect(screen.getByTestId("seat-1")).toHaveValue("Robotina");
});

// -------------------------------------------------- modo paso a paso

test("checkbox de paso a paso está deshabilitado por defecto (asientos humanos)", () => {
  render(<Lobby />);
  expect(screen.getByTestId("step-mode")).toBeDisabled();
  expect(screen.getByTestId("step-mode")).not.toBeChecked();
});

test("se habilita al marcar todos los asientos como agente, y se envía step_mode", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "abc" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  await user.click(screen.getByTestId("seat-1-kind-agent"));
  expect(screen.getByTestId("step-mode")).not.toBeDisabled();

  await user.click(screen.getByTestId("step-mode"));
  await user.click(screen.getByTestId("crear"));

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ step_mode: true })
    )
  );
});

test("volver a marcar un asiento como humano desactiva el paso a paso", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  await user.click(screen.getByTestId("seat-1-kind-agent"));
  await user.click(screen.getByTestId("step-mode"));
  expect(screen.getByTestId("step-mode")).toBeChecked();

  await user.click(screen.getByTestId("seat-0-kind-web"));
  expect(screen.getByTestId("step-mode")).toBeDisabled();
  expect(screen.getByTestId("step-mode")).not.toBeChecked();
});
