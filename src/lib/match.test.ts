import { describe, it, expect } from "vitest";
import { autoMatch, parseMapValues, resolveProductRef, slugify } from "./match.js";

const products = [
  { id: "f3a2cd00-0000-0000-0000-000000000001", name: "Payments API", version: "2.0" },
  { id: "8e0f1bc0-0000-0000-0000-000000000002", name: "checkout-web", version: "1.0" },
  { id: "a91b8c40-0000-0000-0000-000000000003", name: "Beta Agent", version: "2.0.0" },
];

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with single dashes", () => {
    expect(slugify("Payments API")).toBe("payments-api");
    expect(slugify("Beta_Agent v2")).toBe("beta-agent-v2");
    expect(slugify("---weird---")).toBe("weird");
  });
});

describe("autoMatch", () => {
  it("returns exact case-insensitive name match", () => {
    expect(autoMatch("payments api", products)?.name).toBe("Payments API");
  });

  it("returns slug match when names differ in punctuation/spacing", () => {
    expect(autoMatch("Payments-API", products)?.name).toBe("Payments API");
    expect(autoMatch("Checkout Web", products)?.name).toBe("checkout-web");
  });

  it("returns null when no match", () => {
    expect(autoMatch("billing-svc", products)).toBeNull();
  });

  it("returns null when multiple products would match by slug (ambiguous)", () => {
    const dup = [
      { id: "a", name: "Payments API", version: "1" },
      { id: "b", name: "payments-api", version: "2" },
    ];
    // 'Payments_API' has no exact case-insensitive match against either name
    // ('payments_api' vs 'payments api'/'payments-api'), but all three slugify
    // to 'payments-api' — that's the ambiguity we want to reject.
    expect(autoMatch("Payments_API", dup)).toBeNull();
  });
});

describe("resolveProductRef", () => {
  it("resolves a full UUID", () => {
    const r = resolveProductRef("f3a2cd00-0000-0000-0000-000000000001", products);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.product.name).toBe("Payments API");
  });

  it("resolves a unique id prefix", () => {
    const r = resolveProductRef("8e0f", products);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.product.name).toBe("checkout-web");
  });

  it("resolves by exact name", () => {
    const r = resolveProductRef("Beta Agent", products);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.product.id.startsWith("a91b")).toBe(true);
  });

  it("resolves by slug", () => {
    const r = resolveProductRef("payments-api", products);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.product.name).toBe("Payments API");
  });

  it("returns ambiguous when prefix matches more than one id", () => {
    const r = resolveProductRef("00", products);
    expect(r.ok).toBe(false);
  });

  it("returns not_found for unknown refs", () => {
    const r = resolveProductRef("nope-not-here", products);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });
});

describe("parseMapValues", () => {
  it("parses a single PATH:REF value", () => {
    expect(parseMapValues(["apps/payments:Payments API"])).toEqual([
      { path: "apps/payments", ref: "Payments API" },
    ]);
  });

  it("parses multiple values", () => {
    expect(parseMapValues(["a:1", "b:2", "c:3"])).toEqual([
      { path: "a", ref: "1" },
      { path: "b", ref: "2" },
      { path: "c", ref: "3" },
    ]);
  });

  it("only splits on the first colon (refs may contain colons)", () => {
    expect(parseMapValues(["apps/svc:Org:Product"])).toEqual([
      { path: "apps/svc", ref: "Org:Product" },
    ]);
  });

  it("returns empty array on empty input", () => {
    expect(parseMapValues([])).toEqual([]);
  });

  it("throws on malformed values", () => {
    expect(() => parseMapValues(["no-colon"])).toThrow();
    expect(() => parseMapValues([":missing-path"])).toThrow();
    expect(() => parseMapValues(["missing-ref:"])).toThrow();
  });
});
