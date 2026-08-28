import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Lobby from "../src/Lobby.jsx";
import { createMatch, getLLMModels } from "../src/api.js";
import { NOMBRES_EQUIPOS, NOMBRES_HUMANOS, NOMBRES_AGENTES } from "../src/names.js";
import { matchConfigKey, spectatorKey } from "../src/matchStorage.js";

vi.mock("../src/api.js", () => ({
  createMatch: vi.fn(),
  getLLMModels: vi.fn(),
}));

// Nombres por defecto (equipo/jugador) se eligen al azar; se fija
// Math.random en 0 para que cada elección sea el primer elemento
// disponible del pool y las pruebas sean deterministas.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  getLLMModels.mockImplementation(async (provider) => ({
    provider,
    available: true,
    models: provider === "claude"
      ? ["sonnet", "opus"]
      : provider === "codex"
        ? ["gpt-5.6-sol", "gpt-5.6-terra"]
        : provider === "opencode"
          ? ["openai/gpt-5.6-sol", "opencode/big-pickle"]
        : provider === "ollama" ? ["qwen2.5:7b"] : [],
    allow_custom_model: provider !== "ollama",
    message: "Catálogo disponible",
  }));
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
    engine_provider: "codex",
    engine_model: undefined,
    step_mode: false,
    seed: null,
    team_names: undefined,
    flor_enabled: false,
  });
});

test("la variante sin flor es default y puede habilitarse", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "con-flor" });
  render(<Lobby onCreated={vi.fn()} />);

  expect(screen.getByTestId("flor-off")).toHaveClass("on");
  await user.click(screen.getByTestId("flor-on"));
  expect(screen.getByTestId("flor-on")).toHaveClass("on");
  await user.click(screen.getByTestId("crear"));

  await waitFor(() => expect(createMatch).toHaveBeenCalledWith(
    expect.objectContaining({ flor_enabled: true })
  ));
});

test("solo 2v2 genera nombres colectivos para los equipos", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "equipos-2v2" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("mode-2v2"));
  await user.click(screen.getByTestId("crear"));

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "2v2",
        team_names: [NOMBRES_EQUIPOS[0], NOMBRES_EQUIPOS[1]],
      })
    )
  );
});

// -------------------------------------------------- motor de reglas (engine)

test("motor LLM es el default y muestra selector de proveedor", () => {
  render(<Lobby />);
  expect(screen.getByTestId("engine-llm")).toHaveClass("on");
  expect(screen.getByTestId("engine-config")).toBeInTheDocument();
  expect(screen.getByTestId("engine-provider")).toHaveValue("codex");
  expect(screen.getByTestId("engine-provider").querySelector('option[value="mock"]'))
    .not.toBeInTheDocument();
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

  await waitFor(() => expect(
    screen.getByTestId("engine-provider").querySelector('option[value="ollama"]')
  ).not.toBeDisabled());
  await user.selectOptions(screen.getByTestId("engine-provider"), "ollama");
  await waitFor(() => expect(screen.getByTestId("engine-model")).toHaveValue("qwen2.5:7b"));
  expect(screen.queryByTestId("engine-model-custom")).not.toBeInTheDocument();
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

test("deshabilita Ollama en los combos si no responde o no tiene modelos", async () => {
  getLLMModels.mockImplementation(async (provider) => ({
    provider,
    available: provider !== "ollama",
    models: [],
    message: provider === "ollama" ? "Ollama no responde" : "Disponible",
  }));
  const user = userEvent.setup();
  render(<Lobby />);

  const engineOllama = screen
    .getByTestId("engine-provider")
    .querySelector('option[value="ollama"]');
  await waitFor(() => {
    expect(engineOllama).toBeDisabled();
    expect(engineOllama).toHaveTextContent("no disponible");
  });

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  const seatOllama = screen
    .getByTestId("seat-0-provider")
    .querySelector('option[value="ollama"]');
  expect(seatOllama).toBeDisabled();
});

test("mantiene Codex seleccionable si el catálogo HTTP no se puede verificar", async () => {
  getLLMModels.mockRejectedValue(new Error("Not Found"));
  const user = userEvent.setup();
  render(<Lobby />);

  const provider = screen.getByTestId("engine-provider");
  expect(provider.querySelector('option[value="codex"]')).not.toBeDisabled();
  expect(provider.querySelector('option[value="claude"]')).not.toBeDisabled();
  expect(provider.querySelector('option[value="opencode"]')).not.toBeDisabled();
  await waitFor(() => expect(
    provider.querySelector('option[value="ollama"]')
  ).toBeDisabled());

  expect(screen.getByTestId("engine-model")
    .querySelector('option[value="gpt-5.6-sol"]')).toBeInTheDocument();

  await user.selectOptions(provider, "codex");
  expect(provider).toHaveValue("codex");
});

test("muestra y permite elegir modelos detectados para el proveedor", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  await waitFor(() => expect(
    screen.getByTestId("engine-provider").querySelector('option[value="claude"]')
  ).not.toBeDisabled());
  await user.selectOptions(screen.getByTestId("engine-provider"), "claude");
  await waitFor(() => expect(screen.getByTestId("engine-model-status"))
    .toHaveTextContent("Catálogo disponible"));

  const options = screen.getByTestId("engine-model");
  expect(options.querySelector('option[value="sonnet"]')).toBeInTheDocument();
  expect(options.querySelector('option[value="opus"]')).toBeInTheDocument();
  await user.selectOptions(screen.getByTestId("engine-model"), "sonnet");
  expect(screen.getByTestId("engine-model")).toHaveValue("sonnet");
});

test("muestra modelos Codex desde el inicio y excluye mock de agentes", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  const engineModels = screen.getByTestId("engine-model");
  expect(engineModels.querySelector('option[value="gpt-5.6-sol"]')).toBeInTheDocument();

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  const provider = screen.getByTestId("seat-0-provider");
  expect(provider).toHaveValue("codex");
  expect(provider.querySelector('option[value="mock"]')).not.toBeInTheDocument();
  expect(screen.getByTestId("seat-0-model")
    .querySelector('option[value="gpt-5.6-sol"]')).toBeInTheDocument();
});

test("muestra el catálogo vivo de OpenCode en motor y asientos", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  await user.selectOptions(screen.getByTestId("engine-provider"), "opencode");
  await waitFor(() => expect(
    screen.getByTestId("engine-model")
      .querySelector('option[value="openai/gpt-5.6-sol"]')
  ).toBeInTheDocument());
  expect(screen.getByTestId("engine-model")
    .querySelector('option[value="opencode/big-pickle"]')).toBeInTheDocument();

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  await user.selectOptions(screen.getByTestId("seat-0-provider"), "opencode");
  await waitFor(() => expect(
    screen.getByTestId("seat-0-model")
      .querySelector('option[value="openai/gpt-5.6-sol"]')
  ).toBeInTheDocument());
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
  await waitFor(() => expect(screen.getByTestId("seat-1-model")
    .querySelector('option[value="openai/gpt-5.6-sol"]')).toBeInTheDocument());
  await user.selectOptions(screen.getByTestId("seat-1-model"), "openai/gpt-5.6-sol");

  await user.click(screen.getByTestId("crear"));
  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        players: [
          { name: NOMBRES_HUMANOS[0], kind: "web" },
          {
            name: NOMBRES_AGENTES[0], kind: "agent", provider: "opencode",
            model: "openai/gpt-5.6-sol", bluff_level: "equilibrado",
          },
        ],
      })
    )
  );
});

test("nivel de faroleo por defecto es equilibrado y se puede cambiar a mentiroso", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "abc" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("seat-1-kind-agent"));
  expect(screen.getByTestId("seat-1-bluff-equilibrado")).toHaveClass("on");

  await user.click(screen.getByTestId("seat-1-bluff-mentiroso"));
  expect(screen.getByTestId("seat-1-bluff-mentiroso")).toHaveClass("on");
  expect(screen.getByTestId("seat-1-bluff-equilibrado")).not.toHaveClass("on");

  await user.click(screen.getByTestId("crear"));
  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ kind: "agent", bluff_level: "mentiroso" }),
        ]),
      })
    )
  );
});

test("en 2v2 permite definir la picardía por equipo y la heredan sus agentes", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "picardia-equipos" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("mode-2v2"));
  for (let index = 0; index < 4; index++) {
    await user.click(screen.getByTestId(`seat-${index}-kind-agent`));
  }
  await user.click(screen.getByTestId("picardia-scope-team"));
  await user.click(screen.getByTestId("team-0-bluff-mentiroso"));
  await user.click(screen.getByTestId("team-1-bluff-cauteloso"));

  expect(screen.getByTestId("seat-0-bluff-inherited")).toHaveTextContent("Mentiroso");
  expect(screen.getByTestId("seat-2-bluff-inherited")).toHaveTextContent("Mentiroso");
  expect(screen.getByTestId("seat-1-bluff-inherited")).toHaveTextContent("Cauteloso");
  expect(screen.getByTestId("seat-3-bluff-inherited")).toHaveTextContent("Cauteloso");

  await user.click(screen.getByTestId("crear"));
  await waitFor(() => expect(createMatch).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "2v2",
      team_bluff_levels: ["mentiroso", "cauteloso"],
      players: expect.arrayContaining([
        expect.not.objectContaining({ bluff_level: expect.anything() }),
      ]),
    })
  ));
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

test("todos los agentes activan step_mode y preparan la vista de espectador", async () => {
  const user = userEvent.setup();
  createMatch.mockResolvedValue({ match_id: "abc" });
  render(<Lobby onCreated={vi.fn()} />);

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  await user.click(screen.getByTestId("seat-1-kind-agent"));
  expect(screen.getByTestId("step-mode")).not.toBeDisabled();
  expect(screen.getByTestId("step-mode")).toBeChecked();

  await user.click(screen.getByTestId("crear"));

  await waitFor(() =>
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ step_mode: true })
    )
  );
  expect(localStorage.getItem(spectatorKey("abc"))).toBe("1");
  expect(JSON.parse(localStorage.getItem(matchConfigKey("abc"))).players)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "agent", provider: "codex" }),
    ]));
});

test("volver a marcar un asiento como humano desactiva el paso a paso", async () => {
  const user = userEvent.setup();
  render(<Lobby />);

  await user.click(screen.getByTestId("seat-0-kind-agent"));
  await user.click(screen.getByTestId("seat-1-kind-agent"));
  expect(screen.getByTestId("step-mode")).toBeChecked();

  await user.click(screen.getByTestId("seat-0-kind-web"));
  expect(screen.getByTestId("step-mode")).toBeDisabled();
  expect(screen.getByTestId("step-mode")).not.toBeChecked();
});
