# Security Policy

## Reporting a vulnerability

If you discover a security issue in `@cra-ready/cli`, please report it
**privately** via GitHub's [Security Advisories](https://github.com/cra-ready-io/cra-ready-cli/security/advisories/new)
form rather than opening a public issue.

We aim to acknowledge reports within **3 business days** and to ship a fix or
mitigation within **30 days** for confirmed issues.

## Supported versions

Only the latest minor version receives security fixes. Until the project
reaches `1.0`, the latest `0.x` is the only supported line.

| Version        | Supported |
| -------------- | --------- |
| `0.x` (latest) | yes       |
| older `0.x`    | no        |

## Scope

This CLI handles workspace API tokens that authorize SBOM uploads to CRA
Ready. Issues we treat as security-relevant include:

- Token disclosure (printed to logs, written to a world-readable location, sent to an unintended host).
- Authentication or authorization bypass against the CRA Ready API.
- Code execution triggered by hostile repository contents (e.g. malicious `package.json`, `cra-ready.yml`, or SBOM input).
- Tampering with uploaded SBOMs in transit or at rest on this CLI's side.

## How tokens are stored

- Workspace tokens are cached at `~/.cra-ready/config.json` with file mode `0600` and parent directory mode `0700`.
- In CI, prefer the `CRA_READY_TOKEN` environment variable. When this variable is set, the CLI never writes the token to disk.
- Tokens are never logged. The `init` command prints the token **once**, at the end of the device-flow authorization, so the user can copy it into their CI secret store.

## Out of scope

- Vulnerabilities in transitive dependencies that have no security impact on this CLI (e.g. unreachable code paths).
- Issues that require an attacker to already have local code execution as the user.
- Denial-of-service through resource exhaustion in user-controlled inputs (e.g. very large `cra-ready.yml`).
