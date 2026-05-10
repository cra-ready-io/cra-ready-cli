import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findConfigPath = vi.fn();
const readConfig = vi.fn();
const writeConfig = vi.fn();
const readLocalAuth = vi.fn();
const detectPackages = vi.fn();
const listProducts = vi.fn();

vi.mock("../config.js", async () => {
  const actual = await vi.importActual<typeof import("../config.js")>("../config.js");
  return {
    ...actual,
    findConfigPath: (...a: unknown[]) => findConfigPath(...a),
    readConfig: (...a: unknown[]) => readConfig(...a),
    writeConfig: (...a: unknown[]) => writeConfig(...a),
    readLocalAuth: (...a: unknown[]) => readLocalAuth(...a),
  };
});

vi.mock("../detect.js", () => ({
  detectPackages: (...a: unknown[]) => detectPackages(...a),
}));

vi.mock("../api-client.js", async () => {
  const actual = await vi.importActual<typeof import("../api-client.js")>("../api-client.js");
  return {
    ...actual,
    ApiClient: vi.fn().mockImplementation(() => ({
      listProducts: (...a: unknown[]) => listProducts(...a),
    })),
  };
});

import { runLink } from "./link.js";

describe("runLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findConfigPath.mockResolvedValue("/tmp/cra-ready.yml");
    readConfig.mockResolvedValue({
      apiHost: "https://app.example",
      products: [{ id: "old-id", name: "svc-a", path: "apps/a", generator: "npm" }],
    });
    readLocalAuth.mockResolvedValue({
      apiHost: "https://app.example",
      token: "t",
      workspaceId: "w",
    });
    detectPackages.mockResolvedValue([
      { path: "apps/b", name: "svc-b", kind: "node-app", generator: "pnpm" },
    ]);
    listProducts.mockResolvedValue([
      { id: "f3a2cd00-0000-0000-0000-000000000001", name: "Alpha", version: "1.0" },
      { id: "8e0f1bc0-0000-0000-0000-000000000002", name: "Beta", version: "2.0" },
    ]);
  });

  afterEach(() => {
    delete process.env.CRA_READY_DISABLE;
  });

  it("writes the new mapping using the product matched by name", async () => {
    await runLink({ map: ["apps/b:Beta"] });
    expect(writeConfig).toHaveBeenCalledTimes(1);
    const call = writeConfig.mock.calls[0];
    const written = call?.[1] as { products: Array<{ path: string; id: string; name: string }> };
    const mapped = written.products.find((p) => p.path === "apps/b");
    expect(mapped?.id).toBe("8e0f1bc0-0000-0000-0000-000000000002");
    expect(mapped?.name).toBe("Beta");
  });

  it("preserves the generator from the existing entry over detected packages", async () => {
    await runLink({ map: ["apps/a:Alpha"] });
    const written = writeConfig.mock.calls[0]?.[1] as {
      products: Array<{ path: string; generator: string }>;
    };
    expect(written.products.find((p) => p.path === "apps/a")?.generator).toBe("npm");
  });

  it("no-ops when CRA_READY_DISABLE is set", async () => {
    process.env.CRA_READY_DISABLE = "1";
    await runLink({ map: ["apps/b:Beta"] });
    expect(writeConfig).not.toHaveBeenCalled();
  });
});
