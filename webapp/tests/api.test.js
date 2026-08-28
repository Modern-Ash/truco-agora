import { afterEach, describe, expect, test, vi } from "vitest";
import { createMatch, getLLMModels, getState, postStep } from "../src/api.js";

describe("createMatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("envía los nombres de equipo en el JSON de creación", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ match_id: "partida-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createMatch({
      mode: "1v1",
      target_score: 15,
      players: [
        { name: "Fede", kind: "web" },
        { name: "Sofi", kind: "web" },
      ],
      team_names: ["Rosario", "Mendoza"],
      flor_enabled: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      team_names: ["Rosario", "Mendoza"],
      flor_enabled: true,
    }));
  });

  test("solicita las manos visibles solo para la vista de espectador", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ match_id: "partida-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getState("partida-1", undefined, true);

    expect(fetchMock).toHaveBeenCalledWith(
      "/matches/partida-1/state?spectator=true",
      expect.any(Object)
    );
  });

  test("consulta el catálogo de modelos del proveedor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ provider: "codex", models: ["gpt-5.6-sol"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getLLMModels("codex");

    expect(fetchMock).toHaveBeenCalledWith(
      "/llm/models?provider=codex",
      expect.any(Object)
    );
  });

  test("identifica si un step fue manual o automático", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ step_generation: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await postStep("partida-1", "autoplay");

    expect(fetchMock).toHaveBeenCalledWith(
      "/matches/partida-1/step",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ source: "autoplay" }),
      })
    );
  });
});
