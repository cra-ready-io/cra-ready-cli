import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProductConfig } from "./config.js";
import { generateOrLoadSbom } from "./sbom-generator.js";

describe("generateOrLoadSbom", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cra-ready-sbom-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads the file passed via filePath and computes sha256", async () => {
    const path = join(dir, "sbom.json");
    writeFileSync(path, '{"hello":"world"}');
    const product: ProductConfig = {
      id: "p1",
      name: "n",
      path: ".",
      generator: "byo",
    };
    const result = await generateOrLoadSbom(product, dir, path);
    expect(result.bytes.byteLength).toBe(17);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("loads the manifest path for byo products when no --file is given", async () => {
    const manifest = "manifest-sbom.json";
    writeFileSync(join(dir, manifest), '{"x":1}');
    const product: ProductConfig = {
      id: "p1",
      name: "n",
      path: ".",
      generator: "byo",
      manifest,
    };
    const result = await generateOrLoadSbom(product, dir, undefined);
    expect(result.bytes.byteLength).toBe(7);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws for byo products without a manifest path or --file", async () => {
    const product: ProductConfig = {
      id: "p1",
      name: "byo-svc",
      path: ".",
      generator: "byo",
    };
    await expect(generateOrLoadSbom(product, dir, undefined)).rejects.toThrow(/byo/);
  });
});
