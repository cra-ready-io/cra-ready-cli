import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client.js";
import { deviceFlowAuthorize } from "./auth.js";

vi.mock("open", () => ({
  default: vi.fn(async () => undefined),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("deviceFlowAuthorize", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls until approved, then finalizes and returns the token", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(201, {
          code: "ABCDEF",
          verificationUrl: "https://app.example/cli?code=ABCDEF",
          expiresAt,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { status: "pending" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: "approved", workspaceId: "w_1", tokenName: "t" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token: "crar_live_xxx",
          prefix: "crar_live",
          workspaceId: "w_1",
          apiHost: "https://app.example",
        }),
      );

    const api = new ApiClient({ apiHost: "https://app.example", fetch: fetchSpy });

    const promise = deviceFlowAuthorize(api);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.token).toBe("crar_live_xxx");
    expect(result.workspaceId).toBe("w_1");
  });

  it("throws when the code has expired", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(201, {
          code: "X",
          verificationUrl: "u",
          expiresAt,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(410, { status: "expired" }));

    const api = new ApiClient({ apiHost: "https://app.example", fetch: fetchSpy });

    const promise = deviceFlowAuthorize(api);
    // Pre-attach the rejection assertion so the rejection isn't briefly unhandled
    // when fake timers fire the next sleep.
    const assertion = expect(promise).rejects.toThrow(/expired/);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });
});
