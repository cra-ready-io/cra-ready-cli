import open from "open";
import { ApiClient } from "./api-client.js";
import { c, info, success } from "./ui.js";

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000;

export type CliAuthorization = {
  token: string;
  prefix: string;
  workspaceId: string;
  apiHost: string;
};

export async function deviceFlowAuthorize(api: ApiClient): Promise<CliAuthorization> {
  const { code, verificationUrl, expiresAt } = await api.startCli();

  console.log("");
  console.log(`  ${c.bold("Open this URL in your browser:")}`);
  console.log(`  ${c.cyan(verificationUrl)}`);
  console.log("");
  console.log(`  ${c.dim("Or visit /app/cli/auth and enter code:")} ${c.bold(code)}`);
  console.log("");

  try {
    await open(verificationUrl);
  } catch {
    info("Couldn't auto-open browser. Please open the URL above manually.");
  }

  const deadline = Math.min(
    Date.now() + MAX_WAIT_MS,
    new Date(expiresAt).getTime(),
  );

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const status = await api.pollCli(code);
    if (status.status === "pending") continue;
    if (status.status === "expired") {
      throw new Error("Authorization code expired. Run cra-ready init again.");
    }
    if (status.status === "consumed") {
      throw new Error("This code was already used. Run cra-ready init again.");
    }
    if (status.status === "approved") {
      success(`Authorized for workspace ${status.workspaceId}.`);
      const result = await api.finalizeCli(code);
      return {
        token: result.token,
        prefix: result.prefix,
        workspaceId: result.workspaceId,
        apiHost: result.apiHost,
      };
    }
  }

  throw new Error("Timed out waiting for authorization.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
