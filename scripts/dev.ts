import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const python = resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
if (!existsSync(python)) {
  throw new Error("Prepare o backend Python executando uv sync --extra dev.");
}
const backend = spawn(python, ["-m", "backend", "--port", "8000", "--reload"], {
  stdio: "inherit",
});
const frontend = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "0.0.0.0",
    "--port",
    "3000",
    "--strictPort",
  ],
  { stdio: "inherit" }
);
const children = [backend, frontend];
let stopping = false;
function stop() {
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
}
function childExited(code: number | null) {
  if (!stopping) {
    process.exitCode = code ?? 1;
    stop();
  }
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", childExited);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
