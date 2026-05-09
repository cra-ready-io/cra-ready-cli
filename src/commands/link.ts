import { resolve } from "node:path";
import { ApiClient } from "../api-client.js";
import {
  findConfigPath,
  readConfig,
  readLocalAuth,
  writeConfig,
  type ProductConfig,
} from "../config.js";
import { detectPackages } from "../detect.js";
import { parseMapFlags, resolveProductRef } from "../lib/match.js";
import { c, fail, info, success, warn } from "../ui.js";

export async function runLink(rawArgs: string[]): Promise<void> {
  if (process.env.CRA_READY_DISABLE) {
    info("CRA_READY_DISABLE is set; skipping link.");
    return;
  }

  const flags = parseMapFlags(rawArgs);
  if (flags.length === 0) {
    fail(
      "cra-ready link expects at least one --map=PATH:PRODUCT flag.\n" +
        "  Examples:\n" +
        "    cra-ready link --map=apps/payments:Payments-API\n" +
        "    cra-ready link --map=services/billing:8e0f-1bca-…",
    );
    process.exit(2);
  }

  const configPath = await findConfigPath();
  if (!configPath) {
    fail("No cra-ready.yml found. Run `cra-ready init` from your repository root first.");
    process.exit(1);
  }

  const config = await readConfig(configPath);
  const repoRoot = resolve(configPath, "..");

  const token = await resolveToken();
  if (!token) {
    fail(
      "No token. Set CRA_READY_TOKEN in your environment, or run `cra-ready init` to authorize this machine.",
    );
    process.exit(1);
  }

  const api = new ApiClient({ apiHost: config.apiHost, token });
  const products = await api.listProducts();

  // Detect packages so we can preserve `generator` for entries we're about to add.
  const detected = await detectPackages(repoRoot);

  const byPath = new Map(config.products.map((p) => [p.path, p]));
  let touched = 0;

  for (const flag of flags) {
    const r = resolveProductRef(flag.ref, products);
    if (!r.ok) {
      fail(`--map=${flag.path}:${flag.ref} ${r.reason === "ambiguous" ? "matches multiple products" : "didn't match a product"}.`);
      process.exit(1);
    }
    const existing = byPath.get(flag.path);
    const detectedHere = detected.find((d) => d.path === flag.path);
    const next: ProductConfig = {
      id: r.product.id,
      name: r.product.name,
      path: flag.path,
      generator: existing?.generator ?? detectedHere?.generator ?? "npm",
    };
    byPath.set(flag.path, next);
    success(`${c.bold(flag.path)} → ${r.product.name} v${r.product.version}`);
    touched += 1;
  }

  if (touched === 0) {
    warn("No mappings updated.");
    return;
  }

  await writeConfig(configPath, { ...config, products: [...byPath.values()] });
  console.log("");
  success(`Updated ${configPath}`);
}

async function resolveToken(): Promise<string | null> {
  if (process.env.CRA_READY_TOKEN) return process.env.CRA_READY_TOKEN;
  const local = await readLocalAuth();
  return local?.token ?? null;
}
