import { resolve } from "node:path";
import { ApiClient, ApiError } from "../api-client.js";
import {
  findConfigPath,
  readConfig,
  readLocalAuth,
  type CraReadyConfig,
  type ProductConfig,
} from "../config.js";
import { generateOrLoadSbom } from "../sbom-generator.js";
import { c, info, success, warn, fail } from "../ui.js";

export type UploadOptions = {
  product?: string;
  file?: string;
  dryRun?: boolean;
  onlyOn?: string;
};

type Args = {
  product?: string;
  file?: string;
  dryRun: boolean;
  onlyOnCiMain: boolean;
};

export async function runUpload(opts: UploadOptions = {}): Promise<void> {
  if (process.env.CRA_READY_DISABLE) {
    info("CRA_READY_DISABLE is set; skipping upload.");
    return;
  }

  const args: Args = {
    product: opts.product,
    file: opts.file,
    dryRun: opts.dryRun === true,
    onlyOnCiMain: opts.onlyOn === "ci-main",
  };

  if (args.onlyOnCiMain && !shouldRunOnCiMain()) {
    info("Skipping upload (not a main-branch CI run).");
    return;
  }

  const configPath = await findConfigPath();
  if (!configPath) {
    throw new Error(
      "No cra-ready.yml found. Run `cra-ready init` from your repository root first.",
    );
  }
  const config = await readConfig(configPath);
  const repoRoot = resolve(configPath, "..");

  const token = await resolveToken(config);
  if (!token) {
    throw new Error(
      "No token. Set CRA_READY_TOKEN in your environment, or run `cra-ready init` to authorize this machine.",
    );
  }

  const api = new ApiClient({ apiHost: config.apiHost, token });

  const products = filterProducts(config, args.product);
  if (products.length === 0) {
    warn(`No products to upload${args.product ? ` matching "${args.product}"` : ""}.`);
    return;
  }

  const unmapped = products.filter((p) => !p.id);
  if (unmapped.length > 0) {
    fail(
      `Some products in cra-ready.yml don't have an 'id' set: ${unmapped.map((p) => p.name).join(", ")}. ` +
        `Find IDs in your dashboard at ${config.apiHost}/app/products and paste them in.`,
    );
    process.exit(1);
  }

  let uploaded = 0;
  let deduplicated = 0;
  let errored = 0;

  for (const product of products) {
    try {
      const result = await uploadOne({ product, repoRoot, api, args });
      if (result === "uploaded") uploaded += 1;
      else if (result === "deduplicated") deduplicated += 1;
    } catch (err) {
      errored += 1;
      const msg = err instanceof Error ? err.message : String(err);
      fail(`${product.name}: ${msg}`);
      if (err instanceof ApiError && err.code === "token_invalid") {
        // Stop early on auth failures — they affect every subsequent product.
        throw err;
      }
    }
  }

  console.log("");
  console.log(
    `${c.dim("Summary:")} ${c.green(`${uploaded} uploaded`)} · ${c.dim(`${deduplicated} unchanged`)}` +
      (errored > 0 ? ` · ${c.red(`${errored} failed`)}` : ""),
  );
  if (errored > 0) process.exit(1);
}

async function uploadOne({
  product,
  repoRoot,
  api,
  args,
}: {
  product: ProductConfig;
  repoRoot: string;
  api: ApiClient;
  args: Args;
}): Promise<"uploaded" | "deduplicated"> {
  info(`${c.bold(product.name)} (${product.path}) — generating SBOM…`);
  const sbom = await generateOrLoadSbom(product, repoRoot, args.file);

  if (args.dryRun) {
    info(`dry-run: ${sbom.bytes.byteLength} bytes, sha256=${sbom.sha256.slice(0, 12)}…`);
    return "uploaded";
  }

  const intent = await api.createSbomIntent({
    productId: product.id,
    sizeBytes: sbom.bytes.byteLength,
    sha256: sbom.sha256,
    source: {
      tool: "@cra-ready/cli",
      ci: detectCiName(),
      gitRef: process.env.GITHUB_REF ?? process.env.CI_COMMIT_BRANCH ?? undefined,
      gitSha: process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? undefined,
    },
  });

  if (intent.status === "deduplicated") {
    info(`${product.name}: unchanged since last upload (sha matches).`);
    return "deduplicated";
  }

  await api.uploadBytes(intent.upload.url, sbom.bytes);

  const final = await api.finalizeSbom(intent.artifactId, sbom.sha256);
  success(`${product.name}: ${final.components} components → ${c.cyan(final.dashboardUrl)}`);
  return "uploaded";
}

async function resolveToken(_config: CraReadyConfig): Promise<string | null> {
  if (process.env.CRA_READY_TOKEN) return process.env.CRA_READY_TOKEN;
  const local = await readLocalAuth();
  return local?.token ?? null;
}

function filterProducts(config: CraReadyConfig, filter?: string): ProductConfig[] {
  if (!filter) return config.products;
  return config.products.filter((p) => p.id === filter || p.name === filter);
}

function detectCiName(): string | undefined {
  if (process.env.GITHUB_ACTIONS === "true") return "github-actions";
  if (process.env.GITLAB_CI) return "gitlab-ci";
  if (process.env.CIRCLECI) return "circleci";
  if (process.env.BUILDKITE) return "buildkite";
  if (process.env.CI) return "ci";
  return undefined;
}

function shouldRunOnCiMain(): boolean {
  if (!process.env.CI) return false;
  const ref =
    process.env.GITHUB_REF ??
    process.env.CI_COMMIT_BRANCH ??
    process.env.BUILDKITE_BRANCH ??
    process.env.CIRCLE_BRANCH ??
    "";
  const mainBranch = process.env.CRA_READY_MAIN_BRANCH ?? "main";
  return ref === `refs/heads/${mainBranch}` || ref === mainBranch;
}
