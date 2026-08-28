import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const WEB_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(WEB_DIR, "..");
const LOG_FILE = resolve(ROOT_DIR, "logs", "truco-backend-debug.log");
const API_TARGET = process.env.TRUCO_API_TARGET || "http://127.0.0.1:8000";
const API_URL = new URL(API_TARGET);
const children = new Set();
let stopping = false;

function pipeLines(stream, prefix, destination) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) destination.write(`${prefix} ${line}\n`);
  });
  stream.on("end", () => {
    if (pending) destination.write(`${prefix} ${pending}\n`);
  });
}

function launch(command, args, options, prefix) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.add(child);
  pipeLines(child.stdout, prefix, process.stdout);
  pipeLines(child.stderr, prefix, process.stderr);
  child.on("exit", () => children.delete(child));
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 150).unref();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

console.log(`[dev] Backend DEBUG → ${LOG_FILE}`);

async function backendIsRunning() {
  try {
    const response = await fetch(`${API_TARGET}/openapi.json`);
    return response.ok;
  } catch {
    return false;
  }
}

if (await backendIsRunning()) {
  console.error(`[dev] Ya existe un backend en ${API_TARGET}.`);
  console.error("[dev] Detenelo antes de usar npm run dev para poder capturar sus logs en vivo.");
  process.exit(1);
}

const api = launch(
  resolve(ROOT_DIR, ".venv", "bin", "python"),
  [
    "-m", "uvicorn", "truco.api:app", "--reload",
    "--host", API_URL.hostname,
    "--port", API_URL.port || "8000",
  ],
  {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      TRUCO_LOG_LEVEL: process.env.TRUCO_LOG_LEVEL || "DEBUG",
      TRUCO_LOG_FILE: process.env.TRUCO_LOG_FILE ?? LOG_FILE,
    },
  },
  "[api]"
);

api.on("exit", (code, signal) => {
  if (stopping) return;
  console.error(`[dev] El backend terminó (${signal || code}).`);
  stop(code || 1);
});

const web = launch(
  resolve(WEB_DIR, "node_modules", ".bin", "vite"),
  [],
  { cwd: WEB_DIR, env: process.env },
  "[web]"
);

web.on("exit", (code) => {
  if (!stopping) stop(code || 0);
});
