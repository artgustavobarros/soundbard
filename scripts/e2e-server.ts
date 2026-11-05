import { type ChildProcess, execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv, promisify } from "node:util";

const execute = promisify(execFile);
const production = process.argv.includes("--production");
const appPort = testPort(process.env.SOUNDBARD_E2E_PORT, 3312);
const apiPort = testPort(process.env.SOUNDBARD_E2E_API_PORT, 8312);
if (appPort === apiPort) {
  throw new Error("O frontend e o backend E2E precisam de portas distintas.");
}
const origin = `http://127.0.0.1:${appPort}`;
const children: Array<{ child: ChildProcess; done: Promise<number> }> = [];
let stopping = false;
let stopRequested: () => void;
const stopped = new Promise<void>((resolveStop) => {
  stopRequested = resolveStop;
});

function testPort(value: string | undefined, fallback: number) {
  const port = Number(value ?? fallback);
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65_535 ||
    [3000, 8000].includes(port)
  ) {
    throw new Error(
      "Use uma porta E2E válida, diferente das portas de uso do aplicativo."
    );
  }
  return port;
}

function stop() {
  stopping = true;
  for (const { child } of children) {
    child.kill("SIGTERM");
  }
  stopRequested();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  const done = new Promise<number>((resolveExit) => {
    child.once("error", () => resolveExit(1));
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  const running = { child, done };
  children.push(running);
  return running;
}

async function build(env: NodeJS.ProcessEnv) {
  const prepare = async (args: string[]) => {
    if (await start(process.execPath, args, env).done) {
      throw new Error("Não foi possível preparar a interface compilada E2E.");
    }
  };
  await prepare(["node_modules/vite/bin/vite.js", "build"]);
  if (!stopping) {
    await prepare(["scripts/offline.ts"]);
  }
}

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "soundbard-e2e-"));
  const schema = `soundbard_e2e_${randomUUID().replaceAll("-", "")}`;
  const python = resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
  );
  let created = false;
  const configured = parseEnv(
    await readFile(".env", "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    })
  );
  const databaseUrl = process.env.DATABASE_URL ?? configured.DATABASE_URL;
  if (!databaseUrl) {
    await rm(directory, { force: true, recursive: true });
    throw new Error(
      "Configure DATABASE_URL no .env e inicie o PostgreSQL com pnpm db:up."
    );
  }
  const databaseEnv = { ...process.env, DATABASE_URL: databaseUrl };
  const database = (action: "create" | "drop") =>
    execute(python, ["scripts/e2e-database.py", action, schema], {
      env: databaseEnv,
      timeout: 15_000,
    });
  try {
    await database("create");
    created = true;
    const isolated = new URL(databaseUrl);
    isolated.searchParams.set("options", `-c search_path=${schema}`);
    // libpq expects URI spaces (%20), not form encoding (+).
    isolated.search = isolated.searchParams.toString().replaceAll("+", "%20");
    const env = {
      ...process.env,
      DATABASE_URL: isolated.toString(),
      SOUNDBARD_API_URL: `http://127.0.0.1:${apiPort}`,
      SOUNDBARD_DATA_DIR: join(directory, "data"),
      SOUNDBARD_E2E_ENV_DIR: directory,
      SOUNDBARD_ORIGIN: origin,
    };
    if (production) {
      await build(env);
    }
    if (stopping) {
      return;
    }
    const servers = [
      start(
        python,
        ["-m", "backend", "--port", String(production ? appPort : apiPort)],
        env
      ),
    ];
    if (!production) {
      servers.push(
        start(
          process.execPath,
          [
            "node_modules/vite/bin/vite.js",
            "--host",
            "127.0.0.1",
            "--port",
            String(appPort),
            "--strictPort",
          ],
          env
        )
      );
    }
    console.log(`Soundbard E2E isolado: ${origin}`);
    const exit = await Promise.race([
      stopped.then(() => 0),
      ...servers.map((server) => server.done),
    ]);
    if (!stopping) {
      throw new Error(
        `Servidor E2E encerrou antes do fim dos testes (código ${exit}).`
      );
    }
  } catch (error) {
    if (!stopping) {
      throw error;
    }
  } finally {
    stop();
    const force = setTimeout(() => {
      for (const { child } of children) {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }
    }, 5000);
    await Promise.all(children.map((child) => child.done));
    clearTimeout(force);
    try {
      if (created) {
        await database("drop");
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Falha ao iniciar o ambiente E2E."
  );
  process.exitCode = 1;
});
