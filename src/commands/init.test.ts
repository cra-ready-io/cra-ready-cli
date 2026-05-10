import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listProducts = vi.fn();
const detectRepoRoot = vi.fn();
const detectPackages = vi.fn();

vi.mock("../api-client.js", async () => {
  const actual = await vi.importActual<typeof import("../api-client.js")>("../api-client.js");
  return {
    ...actual,
    ApiClient: vi.fn().mockImplementation(() => ({
      listProducts: (...a: unknown[]) => listProducts(...a),
    })),
  };
});

vi.mock("../detect.js", () => ({
  detectRepoRoot: (...a: unknown[]) => detectRepoRoot(...a),
  detectPackages: (...a: unknown[]) => detectPackages(...a),
}));

import { runInit } from "./init.js";
import { CONFIG_FILE_NAME, readConfig } from "../config.js";

describe("runInit", () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), "cra-ready-init-"));
    originalCwd = process.cwd();
    process.env.CRA_READY_TOKEN = "crar_test_token";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
    delete process.env.CRA_READY_DISABLE;
    delete process.env.CRA_READY_TOKEN;
  });

  it("no-ops when CRA_READY_DISABLE is set", async () => {
    process.env.CRA_READY_DISABLE = "1";
    await runInit({});
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("uses CRA_READY_TOKEN to skip the browser flow and writes cra-ready.yml", async () => {
    detectRepoRoot.mockResolvedValue(dir);
    detectPackages.mockResolvedValue([
      { path: "apps/svc", name: "svc", kind: "node-app", generator: "npm" },
    ]);
    listProducts.mockResolvedValue([
      { id: "11111111-1111-1111-1111-111111111111", name: "svc", version: "1.0" },
    ]);

    await runInit({});

    const cfg = await readConfig(join(dir, CONFIG_FILE_NAME));
    expect(cfg.products).toHaveLength(1);
    expect(cfg.products[0]?.id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("falls back to a single repo-root product when nothing is detected", async () => {
    detectRepoRoot.mockResolvedValue(dir);
    detectPackages.mockResolvedValue([]);
    listProducts.mockResolvedValue([]);

    await runInit({});

    const cfg = await readConfig(join(dir, CONFIG_FILE_NAME));
    expect(cfg.products).toHaveLength(1);
    expect(cfg.products[0]?.path).toBe(".");
    expect(cfg.products[0]?.id).toBe("");
  });

  it("merges with an existing cra-ready.yml instead of overwriting", async () => {
    await mkdir(join(dir, "apps", "old"), { recursive: true });
    writeFileSync(
      join(dir, CONFIG_FILE_NAME),
      "apiHost: https://app.example\nproducts:\n  - id: ee\n    name: old-svc\n    path: apps/old\n    generator: npm\n",
    );
    detectRepoRoot.mockResolvedValue(dir);
    detectPackages.mockResolvedValue([
      { path: "apps/new", name: "new-svc", kind: "node-app", generator: "npm" },
    ]);
    listProducts.mockResolvedValue([
      { id: "22222222-2222-2222-2222-222222222222", name: "new-svc", version: "1.0" },
    ]);

    await runInit({});

    const cfg = await readConfig(join(dir, CONFIG_FILE_NAME));
    const paths = cfg.products.map((p) => p.path).sort();
    expect(paths).toEqual(["apps/new", "apps/old"]);
  });
});
