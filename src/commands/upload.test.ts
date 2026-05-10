import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findConfigPath = vi.fn();
const readConfig = vi.fn();
const readLocalAuth = vi.fn();
const generateOrLoadSbom = vi.fn();
const createSbomIntent = vi.fn();
const uploadBytes = vi.fn();
const finalizeSbom = vi.fn();

vi.mock("../config.js", async () => {
  const actual = await vi.importActual<typeof import("../config.js")>("../config.js");
  return {
    ...actual,
    findConfigPath: (...a: unknown[]) => findConfigPath(...a),
    readConfig: (...a: unknown[]) => readConfig(...a),
    readLocalAuth: (...a: unknown[]) => readLocalAuth(...a),
  };
});

vi.mock("../sbom-generator.js", () => ({
  generateOrLoadSbom: (...a: unknown[]) => generateOrLoadSbom(...a),
}));

vi.mock("../api-client.js", async () => {
  const actual = await vi.importActual<typeof import("../api-client.js")>("../api-client.js");
  return {
    ...actual,
    ApiClient: vi.fn().mockImplementation(() => ({
      createSbomIntent: (...a: unknown[]) => createSbomIntent(...a),
      uploadBytes: (...a: unknown[]) => uploadBytes(...a),
      finalizeSbom: (...a: unknown[]) => finalizeSbom(...a),
    })),
  };
});

import { runUpload } from "./upload.js";

describe("runUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findConfigPath.mockResolvedValue("/tmp/cra-ready.yml");
    readConfig.mockResolvedValue({
      apiHost: "https://app.example",
      products: [
        { id: "p_1", name: "svc-a", path: "apps/a", generator: "npm" },
        { id: "p_2", name: "svc-b", path: "apps/b", generator: "npm" },
      ],
    });
    readLocalAuth.mockResolvedValue({
      apiHost: "https://app.example",
      token: "t",
      workspaceId: "w",
    });
    generateOrLoadSbom.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      sha256: "a".repeat(64),
    });
  });

  afterEach(() => {
    delete process.env.CRA_READY_DISABLE;
    delete process.env.CI;
    delete process.env.GITHUB_REF;
    delete process.env.CRA_READY_TOKEN;
  });

  it("no-ops when CRA_READY_DISABLE is set", async () => {
    process.env.CRA_READY_DISABLE = "1";
    await runUpload({});
    expect(generateOrLoadSbom).not.toHaveBeenCalled();
  });

  it("dry-run skips the upload but still generates SBOMs", async () => {
    await runUpload({ dryRun: true });
    expect(generateOrLoadSbom).toHaveBeenCalledTimes(2);
    expect(createSbomIntent).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it("only-on=ci-main returns early when not in CI", async () => {
    await runUpload({ onlyOn: "ci-main" });
    expect(findConfigPath).not.toHaveBeenCalled();
  });

  it("only-on=ci-main runs when CI is set to a main branch", async () => {
    process.env.CI = "true";
    process.env.GITHUB_REF = "refs/heads/main";
    await runUpload({ onlyOn: "ci-main", dryRun: true });
    expect(generateOrLoadSbom).toHaveBeenCalled();
  });

  it("filters to a single product when --product matches a name", async () => {
    await runUpload({ product: "svc-a", dryRun: true });
    expect(generateOrLoadSbom).toHaveBeenCalledTimes(1);
    const call = generateOrLoadSbom.mock.calls[0];
    expect((call?.[0] as { name: string }).name).toBe("svc-a");
  });

  it("uploads + finalizes when not dry-run", async () => {
    createSbomIntent.mockResolvedValue({
      artifactId: "art_1",
      status: "pending",
      upload: { method: "PUT", url: "https://upload", token: "t" },
    });
    finalizeSbom.mockResolvedValue({
      artifactId: "art_1",
      status: "ready",
      components: 5,
      productId: "p_1",
      dashboardUrl: "https://app.example/p_1",
    });
    await runUpload({ product: "svc-a" });
    expect(createSbomIntent).toHaveBeenCalledTimes(1);
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(finalizeSbom).toHaveBeenCalledTimes(1);
  });
});
