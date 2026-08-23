/* E2E de integración: levanta uvicorn y juega una partida completa
   con dos "navegadores" (clientes fetch) sincronizados por polling. */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8123;
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

  // --- web-lobby ---
  const created = await api("/matches", {
    method: "POST",
    body: JSON.stringify({
      mode: "1v1",
      target_score: 15,
      seed: 99,
      players: [{ name: "Ana" }, { name: "Beto" }],
    }),
  });
  const mid = created.match_id;
  console.log(`✓ partida creada (${mid})`);

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
    }),
  });
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
