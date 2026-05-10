#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { runInit } from "./commands/init.js";
import { runLink } from "./commands/link.js";
import { runProducts } from "./commands/products.js";
import { runUpload } from "./commands/upload.js";
import { c } from "./ui.js";
import { VERSION } from "./version.js";

const ENVIRONMENT_HELP = `
Environment:
  CRA_READY_TOKEN         Token for non-interactive use (CI). When set, init skips
                          the browser flow entirely and won't cache locally.
  CRA_READY_DISABLE       When truthy, all commands no-op with exit 0.
  CRA_READY_HOST          Override the API host (default: https://app.cra-ready.io).
  CRA_READY_MAIN_BRANCH   Branch name for --only-on=ci-main (default: main).
`;

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("cra-ready")
    .description("Push SBOMs to CRA Ready from your terminal or CI.")
    .version(VERSION, "-v, --version", "Print version")
    .helpOption("-h, --help", "Show help")
    .showHelpAfterError("(use --help for usage)")
    .addHelpText("after", ENVIRONMENT_HELP);

  program
    .command("init")
    .description(
      "Authorize this machine, detect packages, and write cra-ready.yml. " +
        "Auto-matches detected packages to products by name; --map overrides per path.",
    )
    .option(
      "--map <map...>",
      "PATH:PRODUCT mapping (repeatable). PRODUCT is an id, id-prefix, exact name, or slug.",
    )
    .action(async (opts: { map?: string[] }) => {
      await runInit({ map: opts.map });
    });

  program
    .command("link")
    .description("Add or update product mappings without re-authorizing.")
    .requiredOption(
      "--map <map...>",
      "PATH:PRODUCT mapping (repeatable). PRODUCT is an id, id-prefix, exact name, or slug.",
    )
    .action(async (opts: { map: string[] }) => {
      await runLink({ map: opts.map });
    });

  program
    .command("products")
    .description("List workspace products with their ids. Designed for piping into scripts.")
    .option("--json", "Print products as JSON")
    .option("--ids-only", "Print one product id per line")
    .action(async (opts: { json?: boolean; idsOnly?: boolean }) => {
      await runProducts({ json: opts.json, idsOnly: opts.idsOnly });
    });

  program
    .command("upload")
    .description(
      "Generate and upload SBOMs for products in cra-ready.yml. " +
        "--file uploads an existing SBOM instead of generating one.",
    )
    .option("--product <name>", "Limit upload to a single product (matched by id or name)")
    .option("--file <path>", "Upload an existing SBOM file instead of generating one")
    .option("--dry-run", "Generate without uploading")
    .option("--only-on <when>", "Skip unless condition matches (currently: 'ci-main')")
    .action(
      async (opts: { product?: string; file?: string; dryRun?: boolean; onlyOn?: string }) => {
        await runUpload({
          product: opts.product,
          file: opts.file,
          dryRun: opts.dryRun,
          onlyOn: opts.onlyOn,
        });
      },
    );

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      // Commander already printed its own diagnostic.
      process.exit(err.exitCode);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(c.red(`\nError: ${message}`));
    if (process.env.DEBUG) {
      console.error(err);
    }
    process.exit(1);
  }
}

void main();
