import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_FILE_NAME, findConfigPath, readConfig, writeConfig } from "./config.js";

describe("config", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cra-ready-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("findConfigPath", () => {
    it("returns null when no cra-ready.yml exists in any parent", async () => {
      const sub = join(dir, "deep", "nested");
      await mkdir(sub, { recursive: true });
      expect(await findConfigPath(sub)).toBe(null);
    });

    it("walks up parent directories to find cra-ready.yml", async () => {
      const sub = join(dir, "apps", "svc");
      await mkdir(sub, { recursive: true });
      const target = join(dir, CONFIG_FILE_NAME);
      writeFileSync(
        target,
        "apiHost: x\nproducts:\n  - name: a\n    path: .\n    generator: npm\n",
      );
      expect(await findConfigPath(sub)).toBe(target);
    });
  });

  describe("readConfig + writeConfig", () => {
    it("round-trips a valid config", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      const config = {
        apiHost: "https://example.test",
        products: [
          { id: "abc-123", name: "svc", path: "apps/svc", generator: "pnpm" as const },
          {
            id: "",
            name: "byo-svc",
            path: "apps/byo",
            generator: "byo" as const,
            manifest: "apps/byo/sbom.json",
          },
        ],
      };
      await writeConfig(path, config);
      const reread = await readConfig(path);
      expect(reread).toEqual(config);
    });

    it("rejects empty/malformed yaml", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      writeFileSync(path, "");
      await expect(readConfig(path)).rejects.toThrow(/empty or malformed/);
    });

    it("requires apiHost", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      writeFileSync(path, "products:\n  - name: a\n    path: .\n    generator: npm\n");
      await expect(readConfig(path)).rejects.toThrow(/apiHost/);
    });

    it("requires at least one product", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      writeFileSync(path, "apiHost: x\nproducts: []\n");
      await expect(readConfig(path)).rejects.toThrow(/at least one product/);
    });

    it("requires each product to have name/path/generator", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      writeFileSync(path, "apiHost: x\nproducts:\n  - name: a\n    path: .\n");
      await expect(readConfig(path)).rejects.toThrow(/generator/);
    });

    it("defaults missing id to empty string", async () => {
      const path = join(dir, CONFIG_FILE_NAME);
      writeFileSync(path, "apiHost: x\nproducts:\n  - name: a\n    path: .\n    generator: npm\n");
      const cfg = await readConfig(path);
      expect(cfg.products[0]?.id).toBe("");
    });
  });
});
