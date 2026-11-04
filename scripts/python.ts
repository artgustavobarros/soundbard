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
const child = spawn(python, process.argv.slice(2), { stdio: "inherit" });
child.on("error", (error) => {
  console.error(`Não foi possível iniciar o Python: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
