import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { GeneratorKind } from "./config.js";

export type DetectedPackage = {
  path: string;
  name: string;
  kind: "node-app" | "node-lib";
  generator: GeneratorKind;
};

export async function detectRepoRoot(startDir: string = process.cwd()): Promise<string> {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

export async function detectPackages(repoRoot: string): Promise<DetectedPackage[]> {
  const pnpmWs = join(repoRoot, "pnpm-workspace.yaml");
  if (existsSync(pnpmWs)) {
    return detectPnpmWorkspace(repoRoot, pnpmWs);
  }

  const rootPkgPath = join(repoRoot, "package.json");
  if (!existsSync(rootPkgPath)) return [];

  const rootPkg = JSON.parse(await readFile(rootPkgPath, "utf8")) as {
    name?: string;
    workspaces?: string[] | { packages?: string[] };
  };

  if (rootPkg.workspaces) {
    const globs = Array.isArray(rootPkg.workspaces)
      ? rootPkg.workspaces
      : (rootPkg.workspaces.packages ?? []);
    return expandGlobs(repoRoot, globs, "npm");
  }

  // Single-package repo
  return [
    {
      path: ".",
      name: rootPkg.name ?? repoRoot.split("/").pop() ?? "app",
      kind: classifyByPath("."),
      generator: detectGeneratorFromLockfile(repoRoot),
    },
  ];
}

async function detectPnpmWorkspace(
  repoRoot: string,
  yamlPath: string,
): Promise<DetectedPackage[]> {
  const text = await readFile(yamlPath, "utf8");
  const parsed = parseYaml(text) as { packages?: string[] } | null;
  const globs = parsed?.packages ?? [];
  return expandGlobs(repoRoot, globs, "pnpm");
}

async function expandGlobs(
  repoRoot: string,
  globs: string[],
  generator: GeneratorKind,
): Promise<DetectedPackage[]> {
  const { glob } = await import("node:fs/promises");
  const found: DetectedPackage[] = [];

  for (const pattern of globs) {
    if (pattern.startsWith("!")) continue;
    const cleaned = pattern.endsWith("/*") ? pattern : `${pattern.replace(/\/?$/, "")}/*`;
    try {
      for await (const match of (glob as unknown as (
        p: string,
        opts: { cwd: string },
      ) => AsyncIterable<string>)(cleaned, { cwd: repoRoot })) {
        const abs = resolve(repoRoot, match);
        const pkgPath = join(abs, "package.json");
        if (!existsSync(pkgPath)) continue;
        const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { name?: string };
        const rel = relative(repoRoot, abs) || ".";
        found.push({
          path: rel,
          name: pkg.name ?? rel.split("/").pop() ?? rel,
          kind: classifyByPath(rel),
          generator,
        });
      }
    } catch {
      // glob may not be available on older node — fall back to nothing
    }
  }

  return dedupe(found);
}

function dedupe(items: DetectedPackage[]): DetectedPackage[] {
  const seen = new Set<string>();
  const out: DetectedPackage[] = [];
  for (const item of items) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    out.push(item);
  }
  return out;
}

function classifyByPath(p: string): "node-app" | "node-lib" {
  if (p === "." || p.startsWith("apps/") || p.startsWith("services/")) return "node-app";
  if (p.startsWith("packages/") || p.startsWith("libs/") || p.startsWith("internal/")) {
    return "node-lib";
  }
  return "node-app";
}

function detectGeneratorFromLockfile(repoRoot: string): GeneratorKind {
  if (existsSync(join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(repoRoot, "yarn.lock"))) return "yarn";
  return "npm";
}
