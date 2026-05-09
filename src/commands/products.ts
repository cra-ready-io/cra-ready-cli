import { ApiClient } from "../api-client.js";
import { findConfigPath, readConfig, readLocalAuth } from "../config.js";
import { c, fail, info } from "../ui.js";

const DEFAULT_API_HOST = process.env.CRA_READY_HOST ?? "https://app.cra-ready.io";

export async function runProducts(rawArgs: string[]): Promise<void> {
  if (process.env.CRA_READY_DISABLE) {
    info("CRA_READY_DISABLE is set; skipping products.");
    return;
  }

  const json = rawArgs.includes("--json");
  const idsOnly = rawArgs.includes("--ids-only");

  const apiHost = await resolveApiHost();
  const token = await resolveToken();
  if (!token) {
    fail("No token. Set CRA_READY_TOKEN or run `cra-ready init`.");
    process.exit(1);
  }

  const api = new ApiClient({ apiHost, token });
  const products = await api.listProducts();

  if (json) {
    process.stdout.write(JSON.stringify(products, null, 2) + "\n");
    return;
  }

  if (idsOnly) {
    for (const p of products) process.stdout.write(`${p.id}\n`);
    return;
  }

  if (products.length === 0) {
    info("No products in this workspace yet. Create one in your dashboard.");
    return;
  }

  const idWidth = Math.max(...products.map((p) => Math.min(p.id.length, 36)));
  const nameWidth = Math.max(...products.map((p) => p.name.length));
  for (const p of products) {
    const id = p.id.padEnd(idWidth);
    const name = p.name.padEnd(nameWidth);
    process.stdout.write(`${id}  ${name}  ${c.dim(`v${p.version}`)}\n`);
  }
}

async function resolveApiHost(): Promise<string> {
  const configPath = await findConfigPath();
  if (configPath) {
    try {
      const config = await readConfig(configPath);
      return config.apiHost;
    } catch {
      // fall through
    }
  }
  return DEFAULT_API_HOST;
}

async function resolveToken(): Promise<string | null> {
  if (process.env.CRA_READY_TOKEN) return process.env.CRA_READY_TOKEN;
  const local = await readLocalAuth();
  return local?.token ?? null;
}
