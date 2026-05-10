import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPackages, detectRepoRoot } from "./detect.js";

describe("detectRepoRoot", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cra-ready-detect-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the dir containing .git", async () => {
    await mkdir(join(dir, ".git"));
    const sub = join(dir, "apps", "svc");
    await mkdir(sub, { recursive: true });
    expect(await detectRepoRoot(sub)).toBe(dir);
  });

  it("returns startDir as fallback when no .git is found", async () => {
    expect(await detectRepoRoot(dir)).toBe(dir);
  });
});

describe("detectPackages", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cra-ready-detect-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty array when no package.json exists at the root", async () => {
    expect(await detectPackages(dir)).toEqual([]);
  });

  it("treats a single-package repo as a single 'node-app'", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-app" }));
    const found = await detectPackages(dir);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ path: ".", name: "my-app", kind: "node-app" });
  });

  it("detects pnpm via pnpm-lock.yaml in single-package repos", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-app" }));
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    const [found] = await detectPackages(dir);
    expect(found?.generator).toBe("pnpm");
  });

  it("detects yarn via yarn.lock in single-package repos", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-app" }));
    writeFileSync(join(dir, "yarn.lock"), "");
    const [found] = await detectPackages(dir);
    expect(found?.generator).toBe("yarn");
  });
});
