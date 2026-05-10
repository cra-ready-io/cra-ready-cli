import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", async () => {
  const actual = await vi.importActual<typeof import("../config.js")>("../config.js");
  return {
    ...actual,
    findConfigPath: vi.fn(async () => null),
    readLocalAuth: vi.fn(async () => ({
      apiHost: "https://app.example",
      token: "crar_live_t",
      workspaceId: "w_1",
    })),
  };
});

vi.mock("../api-client.js", async () => {
  const actual = await vi.importActual<typeof import("../api-client.js")>("../api-client.js");
  return {
    ...actual,
    ApiClient: vi.fn().mockImplementation(() => ({
      listProducts: vi.fn(async () => [
        { id: "id-aaaaaa", name: "Alpha", version: "1.0" },
        { id: "id-bbbbbb", name: "Beta", version: "2.0" },
      ]),
    })),
  };
});

import { runProducts } from "./products.js";

describe("runProducts", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stdoutChunks: string[];

  beforeEach(() => {
    stdoutChunks = [];
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdoutChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    delete process.env.CRA_READY_DISABLE;
  });

  it("emits JSON when --json is set", async () => {
    await runProducts({ json: true });
    const output = stdoutChunks.join("");
    expect(output).toContain('"id": "id-aaaaaa"');
    expect(JSON.parse(output)).toHaveLength(2);
  });

  it("emits one id per line when --ids-only is set", async () => {
    await runProducts({ idsOnly: true });
    expect(stdoutChunks.join("")).toBe("id-aaaaaa\nid-bbbbbb\n");
  });

  it("no-ops when CRA_READY_DISABLE is set", async () => {
    process.env.CRA_READY_DISABLE = "1";
    await runProducts({ json: true });
    expect(stdoutChunks.join("")).toBe("");
  });
});
