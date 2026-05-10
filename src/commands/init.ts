import { join } from "node:path";
import { ApiClient } from "../api-client.js";
import { deviceFlowAuthorize } from "../auth.js";
import {
  CONFIG_FILE_NAME,
  findConfigPath,
  readConfig,
  writeConfig,
  writeLocalAuth,
  type CraReadyConfig,
  type ProductConfig,
} from "../config.js";
import { detectPackages, detectRepoRoot, type DetectedPackage } from "../detect.js";
import { autoMatch, parseMapValues, resolveProductRef, type Product } from "../lib/match.js";
import { c, info, success, warn } from "../ui.js";

const DEFAULT_API_HOST = process.env.CRA_READY_HOST ?? "https://app.cra-ready.io";

export type InitOptions = {
  map?: string[];
};

export async function runInit(opts: InitOptions = {}): Promise<void> {
  if (process.env.CRA_READY_DISABLE) {
    info("CRA_READY_DISABLE is set; skipping init.");
    return;
  }

  const mapFlags = parseMapValues(opts.map ?? []);

  console.log(c.bold("\n  Welcome to CRA Ready.\n"));

  const repoRoot = await detectRepoRoot();
  info(`Repo root: ${repoRoot}`);

  const detected = (await detectPackages(repoRoot)).filter((p) => p.kind === "node-app");
  const packages: DetectedPackage[] =
    detected.length > 0
      ? detected
      : [
          {
            path: ".",
            name: repoRoot.split("/").pop() ?? "app",
            kind: "node-app",
            generator: "npm",
          },
        ];

  info(
    detected.length === 0
      ? "No deployable packages detected. Treating the repo as a single product."
      : `Detected ${detected.length} deployable package${detected.length === 1 ? "" : "s"}: ${packages
          .map((p) => p.path)
          .join(", ")}.`,
  );

  const apiHost = DEFAULT_API_HOST;
  const { token, workspaceId, source } = await acquireToken(apiHost);

  const authedApi = new ApiClient({ apiHost, token });

  let products: Product[] = [];
  try {
    products = await authedApi.listProducts();
  } catch (err) {
    warn(`Could not fetch products: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (products.length === 0) {
    warn(
      "No products found in this workspace. Create at least one in your dashboard, then re-run cra-ready init or use cra-ready link.",
    );
  }

  const mapped: ProductConfig[] = [];
  const unmapped: DetectedPackage[] = [];
  const summaryLines: string[] = [];

  for (const pkg of packages) {
    const explicit = mapFlags.find((m) => m.path === pkg.path);
    if (explicit) {
      const r = resolveProductRef(explicit.ref, products);
      if (r.ok) {
        mapped.push(toProductConfig(pkg, r.product));
        summaryLines.push(
          `  ✔ ${c.bold(pkg.path)} → ${r.product.name} v${r.product.version}  ${c.dim("(--map)")}`,
        );
        continue;
      }
      warn(
        `--map=${pkg.path}:${explicit.ref} ${r.reason === "ambiguous" ? "matches multiple products" : "didn't match a product"}.`,
      );
    }

    const auto = autoMatch(pkg.name, products);
    if (auto) {
      mapped.push(toProductConfig(pkg, auto));
      summaryLines.push(
        `  ✔ ${c.bold(pkg.path)} → ${auto.name} v${auto.version}  ${c.dim("(name match)")}`,
      );
      continue;
    }

    unmapped.push(pkg);
    summaryLines.push(
      `  ⚠ ${c.bold(pkg.path)} → ${c.yellow("no match — id is empty in cra-ready.yml")}`,
    );
  }

  const allEntries: ProductConfig[] = [
    ...mapped,
    ...unmapped.map(
      (pkg): ProductConfig => ({
        id: "",
        name: pkg.name,
        path: pkg.path,
        generator: pkg.generator,
      }),
    ),
  ];

  const existingPath = await findConfigPath(repoRoot);
  const targetPath = existingPath ?? join(repoRoot, CONFIG_FILE_NAME);
  const config = await mergeOrCreateConfig(existingPath, apiHost, allEntries);
  await writeConfig(targetPath, config);

  console.log("");
  for (const line of summaryLines) console.log(line);
  console.log("");
  success(`Wrote ${targetPath}`);

  if (source === "device-flow") {
    await writeLocalAuth({ apiHost, token, workspaceId });
    console.log("");
    console.log(c.bold("  Token (save this in your CI secret store as CRA_READY_TOKEN):"));
    console.log(`  ${c.cyan(token)}`);
    console.log(c.dim("  (also cached at ~/.cra-ready/config.json, mode 0600)"));
  } else {
    info("Token came from CRA_READY_TOKEN — not cached locally.");
  }

  if (unmapped.length > 0) {
    console.log("");
    console.log(
      c.yellow(
        `  ${unmapped.length} package${unmapped.length === 1 ? "" : "s"} need${unmapped.length === 1 ? "s" : ""} a product id.`,
      ),
    );
    console.log("");
    if (products.length > 0) {
      console.log(c.bold("  Available products:"));
      for (const p of products) {
        console.log(`    ${c.dim(p.id.slice(0, 8))}  ${p.name} ${c.dim(`v${p.version}`)}`);
      }
      console.log("");
      console.log(c.bold("  To finish setup, either:"));
      console.log(
        `    a) edit ${CONFIG_FILE_NAME} and paste a product id for each empty 'id' field`,
      );
      console.log(`    b) run:`);
      for (const pkg of unmapped) {
        console.log(c.dim(`         cra-ready link --map=${pkg.path}:<product-id-or-name>`));
      }
    } else {
      console.log(c.bold("  Create a product in your dashboard, then run:"));
      console.log(c.dim(`         cra-ready link --map=<path>:<product-id-or-name>`));
    }
  } else if (mapped.length > 0) {
    console.log("");
    success("Setup complete. Run `cra-ready upload` to push your first SBOM.");
  }
}

async function acquireToken(apiHost: string): Promise<{
  token: string;
  workspaceId: string;
  source: "env" | "device-flow";
}> {
  if (process.env.CRA_READY_TOKEN) {
    info("Using CRA_READY_TOKEN from environment (skipping browser auth).");
    return {
      token: process.env.CRA_READY_TOKEN,
      // Workspace will be inferred server-side from the token; we don't need
      // it locally for cra-ready.yml. Use empty string as a placeholder.
      workspaceId: "",
      source: "env",
    };
  }

  console.log(`\n  ${c.dim("Authorize this CLI in your browser…")}\n`);
  const api = new ApiClient({ apiHost });
  const auth = await deviceFlowAuthorize(api);
  return { token: auth.token, workspaceId: auth.workspaceId, source: "device-flow" };
}

function toProductConfig(pkg: DetectedPackage, product: Product): ProductConfig {
  return {
    id: product.id,
    name: product.name,
    path: pkg.path,
    generator: pkg.generator,
  };
}

async function mergeOrCreateConfig(
  existingPath: string | null,
  apiHost: string,
  newProducts: ProductConfig[],
): Promise<CraReadyConfig> {
  if (!existingPath) {
    return { apiHost, products: newProducts };
  }
  try {
    const existing = await readConfig(existingPath);
    const byPath = new Map(existing.products.map((p) => [p.path, p]));
    for (const p of newProducts) byPath.set(p.path, p);
    return { apiHost: existing.apiHost ?? apiHost, products: [...byPath.values()] };
  } catch {
    return { apiHost, products: newProducts };
  }
}
