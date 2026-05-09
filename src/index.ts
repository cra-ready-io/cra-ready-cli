#!/usr/bin/env node
import { runInit } from "./commands/init.js";
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
  // Inlined at build time would be ideal; for v1 we read from package.json
  // sibling at runtime. Keep simple.
  console.log("0.1.0");
}

function printHelp(): void {
  console.log(`${c.bold("cra-ready")} - Push SBOMs to CRA Ready

${c.bold("Commands:")}
  init                   Authorize this machine and link products to this repo
  upload [--file FILE]   Generate and upload SBOMs for products in cra-ready.yml
  --version              Print version
  --help                 Show this message

${c.bold("Options for upload:")}
  --product NAME         Upload only the named product (default: all)
  --file PATH            Use the given SBOM file instead of generating one (BYOSBOM)
  --dry-run              Generate the SBOM but don't ship it

${c.bold("Environment:")}
  CRA_READY_TOKEN        Token for non-interactive uploads (CI). Required for upload
                         when no token is cached locally.
  CRA_READY_DISABLE      If set to a truthy value, all commands no-op with exit 0.
                         Use this to kill the integration without code changes.

${c.dim("Source: https://github.com/cra-ready/cli")}`);
}

void main();
