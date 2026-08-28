/* E2E de integración: levanta uvicorn y juega una partida completa
   con dos "navegadores" (clientes fetch) sincronizados por polling. */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.E2E_PORT || 8123);
const BASE = `http://127.0.0.1:${PORT}`;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(body.detail || String(res.status)), {
      status: res.status,
    });
  return body;
}

async function waitForServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(`${BASE}/openapi.json`);
      return;
    } catch {
      await sleep(250);
    }
  }
  fail("el backend no arrancó");
}

async function decidir(mid, nombre) {
  const v = await api(`/matches/${mid}/state?player=${encodeURIComponent(nombre)}`);
  const pend = v.you?.pending;
  if (!pend) return false;

  let payload;
  if (pend.decision === "offer") payload = { player: nombre, respond: "paso" };
  else if (pend.decision === "response")
    payload = { player: nombre, respond: "no_quiero" };
  else if (pend.decision === "action")
    payload = { player: nombre, action: "play_card", card: v.you.hand[0] };
  else return false;

  try {
    await api(`/matches/${mid}/actions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    if (![409, 422].includes(e.status)) throw e;
    return false;
  }
}

const server = spawn(
  ".venv/bin/python",
  ["-m", "uvicorn", "truco.api:app", "--port", String(PORT)],
  { cwd: "..", stdio: "ignore" }
);

let jugadas = 0;
try {
  await waitForServer();
  console.log("✓ backend arriba");

  const tracedResponse = await fetch(`${BASE}/openapi.json`, {
    headers: { "X-Request-ID": "e2e-observability" },
  });
  if (tracedResponse.headers.get("x-request-id") !== "e2e-observability")
    fail("el backend no propagó el request_id");
  console.log("✓ correlación HTTP por X-Request-ID verificada");

  const mockCatalog = await api("/llm/models?provider=mock");
  if (!mockCatalog.available || mockCatalog.models.length !== 0)
    fail("el catálogo de modelos no respondió para el proveedor mock");
  console.log("✓ catálogo de modelos disponible por HTTP");

  // --- web-lobby ---
  const created = await api("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode: "1v1",
      target_score: 15,
      seed: 99,
      players: [{ name: "Ana" }, { name: "Beto" }],
      team_names: ["Rosario", "Mendoza"],
    }),
  });
  const mid = created.match_id;
  const nombresEquipos = created.state.teams.map((team) => team.name);
  if (nombresEquipos.join(",") !== "Ana,Beto")
    fail(`1v1 no usó los nombres de jugadores: ${nombresEquipos.join(",")}`);
  console.log(`✓ partida creada (${mid})`);
  console.log("✓ 1v1 usa jugadores como equipos y descarta colectividades");

  const diagnostic = await api(`/matches/${mid}/diagnostics`);
  if (!diagnostic.thread_alive || !diagnostic.last_progress_event)
    fail("el diagnóstico vivo no informó el hilo o su último progreso");
  for (const forbidden of ["hand", "cards", "prompt", "credentials"])
    if (Object.hasOwn(diagnostic, forbidden))
      fail(`el diagnóstico expuso el campo sensible ${forbidden}`);
  console.log("✓ diagnóstico vivo seguro de la sesión verificado");

  // --- espectador LLM vs LLM: siguiente movida + generación estable ---
  const llmCreated = await api("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode: "1v1",
      target_score: 15,
      engine: "deterministic",
      step_mode: true,
      players: [
        { name: "Bot A", kind: "agent", provider: "mock", model: "mock-a" },
        { name: "Bot B", kind: "agent", provider: "mock", model: "mock-b" },
      ],
    }),
  });
  let llmState = llmCreated.state;
  for (let i = 0; i < 40 && !llmState.pending_step; i++) {
    await sleep(25);
    llmState = await api(`/matches/${llmCreated.match_id}/state`);
  }
  if (!llmState.pending_step) fail("la partida LLM no publicó la siguiente movida");
  llmState = await api(`/matches/${llmCreated.match_id}/state?spectator=true`);
  const agentA = llmState.others.find((player) => player.name === "Bot A");
  const agentB = llmState.others.find((player) => player.name === "Bot B");
  if (agentA?.agent?.provider !== "mock" || agentA?.agent?.model !== "mock-a")
    fail("el snapshot no publicó proveedor/modelo de Bot A");
  if (agentB?.agent?.provider !== "mock" || agentB?.agent?.model !== "mock-b")
    fail("el snapshot no publicó proveedor/modelo de Bot B");
  if (!llmState.step_mode || llmState.engine_config?.kind !== "deterministic")
    fail("el snapshot no publicó el modo de paso o el motor de reglas");
  if (!llmState.others.every((player) => player.hand?.length === 3))
    fail("la vista de espectador no recibió las manos de ambos agentes");
  let sawPlayedCard = false;
  // Sin seed es la configuración que crea el Lobby: el mock debe priorizar
  // jugar y publicar una carta en pocos pasos, no encadenar abandonos.
  for (let i = 0; i < 12 && !llmState.finished; i++) {
    const beforeGeneration = llmState.step_generation;
    const cardPlayer = llmState.pending_step?.kind === "card"
      ? llmState.pending_step.player
      : null;
    const beforePlayed = cardPlayer
      ? llmState.others.find((player) => player.name === cardPlayer).played.length
      : 0;
    llmState = await api(`/matches/${llmCreated.match_id}/step`, { method: "POST" });
    if (llmState.step_generation <= beforeGeneration)
      fail("la generación no avanzó al liberar la siguiente movida");
    if (!llmState.others.every((player) => Array.isArray(player.hand)))
      fail("las manos desaparecieron después de avanzar una movida");
    if (cardPlayer) {
      const afterPlayed = llmState.others.find(
        (player) => player.name === cardPlayer
      ).played.length;
      if (afterPlayed > beforePlayed) {
        sawPlayedCard = true;
        break;
      }
    }
  }
  if (!sawPlayedCard)
    fail("ninguna carta jugada apareció en el snapshot de autoplay");
  console.log("✓ LLM vs LLM: manos, autoplay y carta jugada visible verificados");

  // Un canto es un evento durable: aunque el polling no alcance el instante
  // de `call_vigente`, la mesa debe poder reconstruir quién cantó y qué.
  const callCreated = await api("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode: "1v1",
      target_score: 15,
      engine: "deterministic",
      step_mode: true,
      players: [
        { name: "Cantor", kind: "agent", provider: "mock", seed: 0 },
        { name: "Respondedor", kind: "agent", provider: "mock", seed: 1 },
      ],
    }),
  });
  let callState = callCreated.state;
  for (let i = 0; i < 40 && !callState.pending_step; i++) {
    await sleep(25);
    callState = await api(`/matches/${callCreated.match_id}/state?spectator=true`);
  }
  let callEvent = null;
  for (let i = 0; i < 8 && !callEvent && !callState.finished; i++) {
    callState = await api(`/matches/${callCreated.match_id}/step`, { method: "POST" });
    callEvent = callState.table_events?.find((event) => event.type === "call");
  }
  if (!callEvent?.call || !callEvent?.player)
    fail("el canto LLM desapareció antes de quedar registrado");
  console.log(`✓ canto durable visible: ${callEvent.player} cantó ${callEvent.call}`);

  // --- web-reparto + web-multijugador ---
  const sA = await api(`/matches/${mid}/state?player=Ana`);
  if (!sA.you || sA.you.hand.length !== 3)
    fail("la mano inicial no tiene 3 cartas");
  const sB = await api(`/matches/${mid}/state?player=Beto`);
  const cartaA = `${sA.you.hand[0].palo}-${sA.you.hand[0].numero}`;
  if (JSON.stringify(sB).includes(cartaA))
    fail("¡las cartas de Ana se filtran a Beto!");
  console.log("✓ reparto y aislamiento de manos verificado");

  // --- web-v2: señas en 2v2 ---
  const c2 = await api("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode: "2v2",
      target_score: 15,
      seed: 7,
      players: [
        { name: "Ana" },
        { name: "Beto" },
        { name: "Clara" },
        { name: "Dino" },
      ],
      team_names: ["Rosario", "Mendoza"],
    }),
  });
  if (c2.state.teams.map((team) => team.name).join(",") !== "Rosario,Mendoza")
    fail("2v2 no preservó las colectividades configuradas");
  await api(`/matches/${c2.match_id}/senas`, {
    method: "POST",
    body: JSON.stringify({ de: "Ana", para: "Clara", sena: "guiño" }),
  });
  const vC1 = await api(
    `/matches/${c2.match_id}/state?player=${encodeURIComponent("Clara")}`
  );
  if (vC1.you?.sena_recibida?.sena !== "guiño")
    fail("Clara no recibió la seña");
  const vC2 = await api(
    `/matches/${c2.match_id}/state?player=${encodeURIComponent("Clara")}`
  );
  if (vC2.you?.sena_recibida) fail("la seña se entregó más de una vez");
  let rechazo = false;
  try {
    await api(`/matches/${c2.match_id}/senas`, {
      method: "POST",
      body: JSON.stringify({ de: "Ana", para: "Beto", sena: "guiño" }),
    });
  } catch {
    rechazo = true;
  }
  if (!rechazo) fail("una seña a un rival fue aceptada");
  console.log("✓ señas: entrega única al compañero y rechazo a rivales");

  // --- web-v2: carta boca abajo ---
  let puesta = false;
  for (let i = 0; i < 500 && !puesta; i++) {
    const st = await api(`/matches/${mid}/state?player=Ana`);
    if (st.finished) break;
    if (st.turn === "Ana" && st.you?.pending?.decision === "action") {
      try {
        await api(`/matches/${mid}/actions`, {
          method: "POST",
          body: JSON.stringify({
            player: "Ana",
            action: "play_card",
            card: st.you.hand[0],
            tapada: true,
          }),
        });
        puesta = true;
      } catch (e) {
        if (![409, 422].includes(e.status)) throw e;
      }
    } else if (st.turn === "Ana" || st.turn === "Beto") {
      await decidir(mid, st.turn);
    }
  }
  if (!puesta) fail("no se pudo jugar una carta tapada");
  const vA = await api(`/matches/${mid}/state?player=Ana`);
  const vBr = await api(`/matches/${mid}/state?player=Beto`);
  const propia = vA.you.played.at(-1);
  const ajena = vBr.others.find((o) => o.name === "Ana")?.played.at(-1);
  if (!propia?.numero) fail("Ana no ve su propia carta tapada");
  if (!ajena || !ajena.tapada) fail("Beto puede ver la carta tapada de Ana");
  jugadas += 1;
  console.log("✓ carta boca abajo: visible para el dueño, dorso para el rival");

  // --- flujo completo hasta fin del chico a 15 ---
  for (let i = 0; i < 20000; i++) {
    const st = await api(`/matches/${mid}/state`);
    if (st.finished) break;
    const turno = st.turn ?? sA.turn;
    if (turno) jugadas += (await decidir(mid, turno)) ? 1 : 0;
    else await sleep(30);
  }

  const final = await api(`/matches/${mid}/state`);
  if (!final.winner) fail("la partida terminó sin ganador");
  const max = Math.max(...final.teams.map((t) => t.score));
  if (max < 15) fail("nadie alcanzó los 15 puntos");
  console.log(
    `✓ partida completa por HTTP en ${jugadas} jugadas — ganó ${final.winner} (${final.teams.map((t) => t.score).join("-")})`
  );
  console.log("\nE2E OK");
} finally {
  server.kill();
}
