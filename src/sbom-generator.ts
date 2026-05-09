import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { ProductConfig } from "./config.js";

export type GeneratedSbom = {
  bytes: Uint8Array;
  sha256: string;
};

export async function generateOrLoadSbom(
  product: ProductConfig,
  repoRoot: string,
  filePath?: string,
): Promise<GeneratedSbom> {
  if (filePath) {
    return loadSbomFromFile(filePath);
  }
  if (product.generator === "byo") {
    if (!product.manifest) {
      throw new Error(
        `Product '${product.name}' has generator: byo but no 'manifest' path. Provide --file or set 'manifest' in cra-ready.yml.`,
      );
    }
    return loadSbomFromFile(resolve(repoRoot, product.manifest));
  }

  return generateSbomForProduct(product, repoRoot);
}

async function loadSbomFromFile(path: string): Promise<GeneratedSbom> {
  const buf = await readFile(path);
  const sha = createHash("sha256").update(buf).digest("hex");
  return { bytes: new Uint8Array(buf), sha256: sha };
}

async function generateSbomForProduct(
  product: ProductConfig,
  repoRoot: string,
): Promise<GeneratedSbom> {
  const cwd = resolve(repoRoot, product.path);

  // Use the cyclonedx-npm CLI as a subprocess. It writes JSON to stdout.
  const args = [
    "--package-lock-only",
    "--output-format=JSON",
    "--spec-version=1.5",
    "--output-reproducible",
    "--mc-type=application",
  ];

  const stdout = await runCommand("cyclonedx-npm", args, cwd);
  const buf = Buffer.from(stdout);
  const sha = createHash("sha256").update(buf).digest("hex");
  return { bytes: new Uint8Array(buf), sha256: sha };
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", rej);
    child.on("close", (code) => {
      if (code === 0) res(out);
      else
        rej(
          new Error(
            `${cmd} exited with code ${code}.\n${err.trim() || "No stderr output."}\n` +
              `Hint: cyclonedx-npm should be available via npx within @cra-ready/cli's deps.`,
          ),
        );
    });
  });
}
