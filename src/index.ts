#!/usr/bin/env node
import { runInit } from "./commands/init.js";
import { runLink } from "./commands/link.js";
import { runProducts } from "./commands/products.js";
import { runUpload } from "./commands/upload.js";
import { c } from "./ui.js";

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "init":
        await runInit(rest);
        break;
      case "link":
        await runLink(rest);
        break;
      case "products":
        await runProducts(rest);
        break;
      case "upload":
        await runUpload(rest);
        break;
      case "--version":
      case "-v":
        printVersion();
        break;
      default:
        console.error(c.red(`Unknown command: ${command}\n`));
        printHelp();
        process.exit(2);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(c.red(`\nError: ${message}`));
    if (process.env.DEBUG) {
      console.error(err);
    }
    process.exit(1);
  }
}

function printVersion(): void {
  console.log("0.1.0");
}

function printHelp(): void {
  console.log(`${c.bold("cra-ready")} — push SBOMs to CRA Ready

${c.bold("Commands:")}
  init [--map=PATH:PRODUCT]...    Authorize this machine, detect packages, and write
                                  cra-ready.yml. Auto-matches detected packages to
                                  products by name; --map overrides per path.

  link --map=PATH:PRODUCT [...]   Add or update mappings without re-authorizing.
                                  PRODUCT is an id, id-prefix, exact name, or slug.

  products [--json|--ids-only]    List workspace products with their ids. Designed
                                  for piping into scripts and AI agents.

  upload [--product NAME]         Generate and upload SBOMs for products in
         [--file PATH]            cra-ready.yml. --file uploads an existing SBOM
         [--dry-run]              instead of generating. --only-on=ci-main skips
         [--only-on=ci-main]      runs that aren't on the main branch in CI.

  --version                       Print version
  --help                          Show this message

${c.bold("Environment:")}
  CRA_READY_TOKEN     Token for non-interactive use (CI). When set, init skips
                      the browser flow entirely and won't cache locally.
  CRA_READY_DISABLE   When truthy, all commands no-op with exit 0.
  CRA_READY_HOST      Override the API host (default: https://app.cra-ready.io).
  CRA_READY_MAIN_BRANCH   Branch name for --only-on=ci-main (default: main).

${c.dim("Source: https://github.com/cra-ready/cli")}`);
}

void main();
