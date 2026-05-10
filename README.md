# @cra-ready/cli

Push SBOMs to [CRA Ready](https://app.cra-ready.io) from your terminal or CI.

## Why this exists

Manual SBOM uploads via the dashboard are friction. This CLI runs in your CI on every merge to main and ships a fresh SBOM automatically.

**No GitHub App. No repo read access. The CLI only sends the SBOM you generate locally.** That trust posture is the whole reason we ship a CLI instead of a centralized integration.

## Install (one-time)

```sh
npm i -D @cra-ready/cli
# or run on the fly:
npx -y @cra-ready/cli@latest <command>
```

## Usage

### 1. Authorize this machine

In your repository:

```sh
npx -y @cra-ready/cli@latest init
```

Opens your browser, asks which products this CLI should be authorized for, mints a token, writes `cra-ready.yml` to the repo root, and caches the token to `~/.cra-ready/config.json` (mode `0600`) so subsequent commands work without re-auth.

### 2. Upload from CI

Add to your existing main-branch workflow (GitHub Actions example):

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npx -y @cra-ready/cli@latest upload
  env:
    CRA_READY_TOKEN: ${{ secrets.CRA_READY_TOKEN }}
```

Save the token printed by `init` as the `CRA_READY_TOKEN` secret in your repo settings.

### Bring your own SBOM

If you already generate SBOMs with another tool (syft, snyk, dependency-track), point `cra-ready upload` at the file:

```sh
cra-ready upload --file ./my-sbom.cdx.json
```

Or configure it per-product in `cra-ready.yml`:

```yaml
api_host: https://app.cra-ready.io
products:
  - id: <uuid>
    name: payments-api
    path: services/payments
    generator: byo
    manifest: services/payments/sbom.cdx.json
```

## Configuration

`cra-ready.yml` (committed to the repo):

```yaml
api_host: https://app.cra-ready.io
products:
  - id: <uuid>
    name: payments-api
    path: apps/payments
    generator: pnpm
  - id: <uuid>
    name: checkout-web
    path: apps/checkout
    generator: pnpm
```

Single-package repos: `products` has length 1 with `path: "."`. Same shape, no special-case logic.

## Environment variables

| Variable                | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `CRA_READY_TOKEN`       | Token for non-interactive uploads. Required in CI.                            |
| `CRA_READY_DISABLE`     | If set, all commands no-op. Use to kill the integration without code changes. |
| `CRA_READY_HOST`        | Override the API host (default: `https://app.cra-ready.io`).                  |
| `CRA_READY_MAIN_BRANCH` | Branch name for `--only-on=ci-main` (default: `main`).                        |

## Source

This CLI is open source by design. Read it before installing it: <https://github.com/cra-ready-io/cra-ready-cli>.

## License

MIT
