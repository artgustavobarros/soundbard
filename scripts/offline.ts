import { createHash } from "node:crypto";
import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import ts from "typescript";

const root = "dist/client";
await copyFile(join(root, "_shell.html"), join(root, "index.html"));
async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(join(path, entry.name))
        : Promise.resolve([join(path, entry.name)])
    )
  );
  return groups.flat().filter((file) => !file.endsWith("/sw.js"));
}
const files = await walk(root);
const hash = createHash("sha256");
const contents = await Promise.all(files.map((file) => readFile(file)));
for (const content of contents) {
  hash.update(content);
}
const source = (await readFile("src/service-worker.ts", "utf8"))
  .replace(
    "declare const PRECACHE: string[]",
    `const PRECACHE: string[] = ${JSON.stringify(files.map((file) => `/${relative(root, file)}`))}`
  )
  .replace(
    "declare const CACHE_VERSION: string",
    `const CACHE_VERSION = ${JSON.stringify(`soundbard-${hash.digest("hex").slice(0, 12)}`)}`
  );
await writeFile(
  join(root, "sw.js"),
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
);
console.log(`Offline preparado: ${files.length} arquivos da interface.`);
