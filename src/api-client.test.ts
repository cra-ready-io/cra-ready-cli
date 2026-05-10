import { describe, it, expect, vi } from "vitest";
import { ApiClient, ApiError } from "./api-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("attaches Bearer token when provided", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { code: "X", verificationUrl: "u", expiresAt: "z" }));
    const api = new ApiClient({ apiHost: "https://app.x", token: "crar_live_t", fetch: fetchSpy });
    await api.startCli();
    const init = fetchSpy.mock.calls[0]![1];
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer crar_live_t");
  });

  it("throws ApiError with parsed problem details", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        type: "https://app.cra-ready.io/errors/token_invalid",
        title: "token invalid",
        status: 401,
        detail: "Token has been revoked.",
      }),
    );
    const api = new ApiClient({ apiHost: "https://app.x", token: "x", fetch: fetchSpy });
    await expect(
      api.createSbomIntent({ productId: "p", sizeBytes: 1, sha256: "s" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("returns deduplicated intent without an upload URL", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { artifactId: "a1", status: "deduplicated" }));
    const api = new ApiClient({ apiHost: "https://app.x", token: "t", fetch: fetchSpy });
    const result = await api.createSbomIntent({ productId: "p", sizeBytes: 1, sha256: "s" });
    expect(result).toEqual({ artifactId: "a1", status: "deduplicated" });
  });
});
