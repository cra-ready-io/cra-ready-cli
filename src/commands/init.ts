import { resolve, join } from "node:path";
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
import { detectPackages, detectRepoRoot } from "../detect.js";
import { c, info, success, warn } from "../ui.js";

const DEFAULT_API_HOST = process.env.CRA_READY_HOST ?? "https://app.cra-ready.io";

export async function runInit(_args: string[]): Promise<void> {
  if (process.env.CRA_READY_DISABLE) {
    info("CRA_READY_DISABLE is set; skipping init.");
    return;
  }

  console.log(c.bold("\n  Welcome to CRA Ready.\n"));

  const repoRoot = await detectRepoRoot();
  info(`Repo root: ${repoRoot}`);

  const detected = await detectPackages(repoRoot);
  info(
    detected.length === 0
      ? "No packages detected. Will treat the repo as a single product."
      : `Detected ${detected.length} package${detected.length === 1 ? "" : "s"}.`,
  );

  const apiHost = DEFAULT_API_HOST;
  const api = new ApiClient({ apiHost });

  console.log(`\n  ${c.dim("Authorize this CLI in your browser…")}\n`);
  const auth = await deviceFlowAuthorize(api);

  // Persist auth for local (laptop) use; CI users will set CRA_READY_TOKEN env var.
  await writeLocalAuth({
    apiHost: auth.apiHost,
    token: auth.token,
    workspaceId: auth.workspaceId,
  });
  success("Saved auth to ~/.cra-ready/config.json (mode 0600).");

  // Map approved product IDs to detected paths.
  const productConfigs = await mapApprovedProducts(auth.scopedProductIds, detected);

  const existingPath = await findConfigPath(repoRoot);
  const targetPath = existingPath ?? join(repoRoot, CONFIG_FILE_NAME);
  const config: CraReadyConfig = await mergeOrCreateConfig(
    existingPath,
    apiHost,
    productConfigs,
  );
  await writeConfig(targetPath, config);
  success(`Wrote ${targetPath}`);

  console.log("");
  console.log(c.bold("  Token (save this in your CI secret store as CRA_READY_TOKEN):"));
  console.log(`  ${c.cyan(auth.token)}`);
  console.log("");
  console.log(c.dim("  This token won't be shown again. It is also cached locally for"));
  console.log(c.dim("  ad-hoc `cra-ready upload` runs from this machine."));
  console.log("");

  const ghaSnippet = `- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npx -y @cra-ready/cli@latest upload
  env:
    CRA_READY_TOKEN: \${{ secrets.CRA_READY_TOKEN }}`;

  console.log(c.bold("  Add this step to your CI workflow (GitHub Actions example):"));
  console.log(`  ${c.dim(ghaSnippet.split("\n").join("\n  "))}`);
  console.log("");
  success(
    "Setup complete. Run `cra-ready upload` to do a first push, or merge to main and let CI run it.",
  );
}

async function mapApprovedProducts(
  scopedProductIds: string[],
  detected: { path: string; name: string; generator: string }[],
): Promise<ProductConfig[]> {
  // For v1, we don't have product names from the server (they were chosen in the
  // browser). The CLI just records the IDs and a best-guess path. The user can
  // later edit cra-ready.yml to refine paths.
  if (scopedProductIds.length === 0) {
    warn("No products were approved for this token.");
    return [];
  }

  const apps = detected.filter((d) => !d.path.startsWith("packages/"));

  if (scopedProductIds.length === 1) {
    const path = apps[0]?.path ?? ".";
    return [
      {
        id: scopedProductIds[0]!,
        name: apps[0]?.name ?? "app",
        path,
        generator: (apps[0]?.generator ?? "npm") as ProductConfig["generator"],
      },
    ];
  }

  // Multiple products approved → pair best-effort with detected packages.
  return scopedProductIds.map((id, i): ProductConfig => {
    const match = apps[i] ?? apps[0];
    return {
      id,
      name: match?.name ?? `product-${i + 1}`,
      path: match?.path ?? ".",
      generator: (match?.generator ?? "npm") as ProductConfig["generator"],
    };
  });
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
    const byId = new Map(existing.products.map((p) => [p.id, p]));
    for (const p of newProducts) byId.set(p.id, p);
    return { apiHost: existing.apiHost ?? apiHost, products: [...byId.values()] };
  } catch {
    return { apiHost, products: newProducts };
  }
}

// Re-export for tests
export const __test = { mapApprovedProducts, mergeOrCreateConfig };
export const __resolveRoot = resolve;
