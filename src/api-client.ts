export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

type Problem = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
};

async function readError(res: Response): Promise<ApiError> {
  let body: Problem = {};
  try {
    body = (await res.json()) as Problem;
  } catch {
    // ignore
  }
  const code =
    body.type?.split("/").pop() ?? body.title ?? `http_${res.status}`;
  const detail = body.detail ?? body.title ?? `HTTP ${res.status}`;
  return new ApiError(res.status, code, detail);
}

export type ApiClientOptions = {
  apiHost: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
};

export class ApiClient {
  private apiHost: string;
  private token?: string;
  private fetchImpl: typeof globalThis.fetch;

  constructor(opts: ApiClientOptions) {
    this.apiHost = opts.apiHost.replace(/\/$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", ...extra };
    if (this.token) h["authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async startCli(): Promise<{ code: string; verificationUrl: string; expiresAt: string }> {
    const res = await this.fetchImpl(`${this.apiHost}/api/v1/cli/start`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw await readError(res);
    return (await res.json()) as { code: string; verificationUrl: string; expiresAt: string };
  }

  async pollCli(code: string): Promise<
    | { status: "pending" }
    | { status: "approved"; workspaceId: string; tokenName: string }
    | { status: "expired" }
    | { status: "consumed" }
  > {
    const res = await this.fetchImpl(
      `${this.apiHost}/api/v1/cli/poll?code=${encodeURIComponent(code)}`,
      { headers: this.headers() },
    );
    if (res.status === 410) {
      return (await res.json()) as { status: "expired" } | { status: "consumed" };
    }
    if (!res.ok) throw await readError(res);
    return (await res.json()) as
      | { status: "pending" }
      | { status: "approved"; workspaceId: string; tokenName: string };
  }

  async finalizeCli(code: string): Promise<{
    token: string;
    prefix: string;
    workspaceId: string;
    apiHost: string;
  }> {
    const res = await this.fetchImpl(`${this.apiHost}/api/v1/cli/finalize`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw await readError(res);
    return (await res.json()) as {
      token: string;
      prefix: string;
      workspaceId: string;
      apiHost: string;
    };
  }

  async listProducts(): Promise<Array<{ id: string; name: string; version: string }>> {
    const res = await this.fetchImpl(`${this.apiHost}/api/v1/products`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await readError(res);
    const body = (await res.json()) as {
      products: Array<{ id: string; name: string; version: string }>;
    };
    return body.products;
  }

  async createSbomIntent(input: {
    productId: string;
    sizeBytes: number;
    sha256: string;
    source?: Record<string, string | undefined>;
  }): Promise<
    | {
        artifactId: string;
        status: "pending";
        upload: { method: "PUT"; url: string; token: string };
      }
    | { artifactId: string; status: "deduplicated" }
  > {
    const res = await this.fetchImpl(`${this.apiHost}/api/v1/sboms/intents`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await readError(res);
    return (await res.json()) as
      | {
          artifactId: string;
          status: "pending";
          upload: { method: "PUT"; url: string; token: string };
        }
      | { artifactId: string; status: "deduplicated" };
  }

  async uploadBytes(url: string, body: Uint8Array): Promise<void> {
    const res = await this.fetchImpl(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, "upload_failed", `Storage upload failed: ${text}`);
    }
  }

  async finalizeSbom(
    artifactId: string,
    sha256: string,
  ): Promise<{
    artifactId: string;
    status: "ready";
    components: number;
    productId: string;
    dashboardUrl: string;
  }> {
    const res = await this.fetchImpl(
      `${this.apiHost}/api/v1/sboms/${artifactId}/finalize`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ sha256 }),
      },
    );
    if (!res.ok) throw await readError(res);
    return (await res.json()) as {
      artifactId: string;
      status: "ready";
      components: number;
      productId: string;
      dashboardUrl: string;
    };
  }
}
