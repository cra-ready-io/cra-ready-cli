export type Product = { id: string; name: string; version: string };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find the single product that matches `detectedName` exactly (case-insensitive)
 * or via slug. Returns `null` if no match or if multiple products would match.
 */
export function autoMatch(detectedName: string, products: Product[]): Product | null {
  const targetSlug = slugify(detectedName);
  if (!targetSlug) return null;

  const exact = products.filter((p) => p.name.toLowerCase() === detectedName.toLowerCase());
  if (exact.length === 1) return exact[0]!;

  const slug = products.filter((p) => slugify(p.name) === targetSlug);
  if (slug.length === 1) return slug[0]!;

  return null;
}

/**
 * Resolve a user-supplied product reference (id, exact name, or slug) to a
 * single product. Returns null if no unique match.
 */
export function resolveProductRef(
  ref: string,
  products: Product[],
): { ok: true; product: Product } | { ok: false; reason: "not_found" | "ambiguous" } {
  const trimmed = ref.trim();
  if (!trimmed) return { ok: false, reason: "not_found" };

  // 1. UUID-like → match by id
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    const byId = products.find((p) => p.id.toLowerCase() === trimmed.toLowerCase());
    return byId ? { ok: true, product: byId } : { ok: false, reason: "not_found" };
  }

  // 2. Prefix of an id (we show truncated IDs in CLI output, so users may copy a prefix)
  if (/^[0-9a-f-]{4,}$/i.test(trimmed)) {
    const byPrefix = products.filter((p) => p.id.toLowerCase().startsWith(trimmed.toLowerCase()));
    if (byPrefix.length === 1) return { ok: true, product: byPrefix[0]! };
    if (byPrefix.length > 1) return { ok: false, reason: "ambiguous" };
  }

  // 3. Exact name (case-insensitive)
  const exactName = products.filter((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (exactName.length === 1) return { ok: true, product: exactName[0]! };
  if (exactName.length > 1) return { ok: false, reason: "ambiguous" };

  // 4. Slug
  const slug = slugify(trimmed);
  if (slug) {
    const bySlug = products.filter((p) => slugify(p.name) === slug);
    if (bySlug.length === 1) return { ok: true, product: bySlug[0]! };
    if (bySlug.length > 1) return { ok: false, reason: "ambiguous" };
  }

  return { ok: false, reason: "not_found" };
}

export type MapFlag = { path: string; ref: string };

/**
 * Parse repeatable `--map PATH:REF` values (already split by the CLI parser)
 * into structured form. Splits on the first `:` so refs can contain colons
 * (rare, but possible in product names).
 */
export function parseMapValues(values: readonly string[]): MapFlag[] {
  const out: MapFlag[] = [];
  for (const value of values) {
    const idx = value.indexOf(":");
    if (idx === -1) {
      throw new Error(`--map expects PATH:REF, got: ${value}`);
    }
    const path = value.slice(0, idx).trim();
    const ref = value.slice(idx + 1).trim();
    if (!path || !ref) {
      throw new Error(`--map expects non-empty PATH and REF, got: ${value}`);
    }
    out.push({ path, ref });
  }
  return out;
}
