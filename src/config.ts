import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type GeneratorKind = "pnpm" | "npm" | "yarn" | "byo";

export type ProductConfig = {
  id: string;
  name: string;
  path: string;
  generator: GeneratorKind;
  manifest?: string;
};

export type CraReadyConfig = {
  apiHost: string;
  products: ProductConfig[];
};

export const CONFIG_FILE_NAME = "cra-ready.yml";

export async function findConfigPath(startDir: string = process.cwd()): Promise<string | null> {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, CONFIG_FILE_NAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function readConfig(path: string): Promise<CraReadyConfig> {
  const text = await readFile(path, "utf8");
  const parsed = parseYaml(text) as Partial<CraReadyConfig> | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${CONFIG_FILE_NAME} is empty or malformed.`);
  }
  if (!parsed.apiHost) {
    throw new Error(`${CONFIG_FILE_NAME} is missing 'apiHost'.`);
  }
  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    throw new Error(`${CONFIG_FILE_NAME} must declare at least one product.`);
  }

  const products: ProductConfig[] = parsed.products.map((p, i) => {
    if (!p.name) throw new Error(`products[${i}] is missing 'name'.`);
    if (!p.path) throw new Error(`products[${i}] is missing 'path'.`);
    if (!p.generator) throw new Error(`products[${i}] is missing 'generator'.`);
    return {
      id: p.id ?? "",
      name: p.name,
      path: p.path,
      generator: p.generator,
      manifest: p.manifest,
    };
  });

  return { apiHost: parsed.apiHost, products };
}

export async function writeConfig(path: string, config: CraReadyConfig): Promise<void> {
  const yaml = stringifyYaml(config, { indent: 2 });
  await writeFile(path, yaml, "utf8");
}

const HOME_CONFIG_DIR = join(homedir(), ".cra-ready");
const HOME_CONFIG_FILE = join(HOME_CONFIG_DIR, "config.json");

export type LocalAuth = {
  apiHost: string;
  token: string; // plaintext — file is mode 0600
  workspaceId: string;
};

export async function readLocalAuth(): Promise<LocalAuth | null> {
  if (!existsSync(HOME_CONFIG_FILE)) return null;
  const text = await readFile(HOME_CONFIG_FILE, "utf8");
  const parsed = JSON.parse(text) as LocalAuth;
  return parsed;
}

export async function writeLocalAuth(auth: LocalAuth): Promise<void> {
  await mkdir(HOME_CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(HOME_CONFIG_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}
