# Contributing to `@cra-ready/cli`

Thanks for your interest in contributing! This file covers the everyday
mechanics: setup, scripts, conventions, and how releases work.

## Prerequisites

- Node.js `>= 20` (use [`nvm`](https://github.com/nvm-sh/nvm) or
  [`fnm`](https://github.com/Schniz/fnm) and `nvm use` / `fnm use` to pick up
  the version pinned in [`.nvmrc`](.nvmrc)).
- npm 10+ (ships with Node 20).

## Setup

```sh
git clone https://github.com/cra-ready/cli.git
cd cli
npm install
```

The `prepare` script wires up Husky's git hooks during install. After install,
commits will run [`lint-staged`](https://github.com/lint-staged/lint-staged)
on staged files (Prettier + ESLint with `--fix`).

## Scripts

| Script                  | What it does                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run build`         | Compiles `src/` → `dist/` via `tsc`.                               |
| `npm run dev`           | Watch-mode build.                                                  |
| `npm run typecheck`     | Runs `tsc --noEmit`.                                               |
| `npm run test`          | Runs the Vitest suite once.                                        |
| `npm run test:watch`    | Vitest in watch mode.                                              |
| `npm run test:coverage` | Vitest with v8 coverage.                                           |
| `npm run lint`          | ESLint over the repo.                                              |
| `npm run lint:fix`      | ESLint with `--fix`.                                               |
| `npm run format`        | Prettier `--write`.                                                |
| `npm run format:check`  | Prettier `--check` (CI uses this).                                 |
| `npm run ci`            | Runs typecheck → lint → format:check → test → build.               |
| `npm run changeset`     | Adds a [changeset](https://github.com/changesets/changesets) file. |

## Development loop

1. Create a branch off `main`.
2. Make your changes. Tests live next to the code they cover (`*.test.ts`).
3. Run `npm run ci` locally before pushing.
4. **Add a changeset**: `npm run changeset`. Pick the bump kind (patch/minor/major) and write a short user-facing note. Commit the generated file in `.changeset/`.
5. Open a pull request. CI runs lint, typecheck, tests, and build on Node 20 and 22.

## Commit messages

We don't enforce a particular convention, but please:

- Keep the subject under ~70 characters and use the imperative mood ("add", "fix", not "added", "fixes").
- Explain _why_ in the body when the change isn't obvious.

## Releases

This repo uses [Changesets](https://github.com/changesets/changesets) +
GitHub Actions for releases:

- Every PR that affects user-visible behavior should include a changeset.
- When changesets land on `main`, the **Release** workflow opens (or updates) a
  "Version Packages" PR that bumps the version in `package.json` and
  regenerates `CHANGELOG.md`.
- Merging that PR triggers the publish step, which pushes the new version to
  npm (with [provenance attestations](https://docs.npmjs.com/generating-provenance-statements)) and creates a Git tag.

You don't need to bump versions or edit the changelog by hand — Changesets
owns both.

## Tests

We use Vitest. Tests are colocated with source as `*.test.ts`. Patterns we follow:

- The HTTP client at [`src/api-client.ts`](src/api-client.ts) accepts an
  injectable `fetch`, so tests pass a `vi.fn()` that returns `Response`
  objects rather than mocking globals.
- File-system tests use `fs.mkdtempSync(path.join(os.tmpdir(), "cra-ready-"))`
  and clean up in `afterEach`.
- Prefer testing public exports over internal helpers.

## Reporting bugs / requesting features

Open an issue using one of the templates at
<https://github.com/cra-ready/cli/issues/new/choose>. Security issues should
follow the process in [`SECURITY.md`](SECURITY.md) instead of being filed
publicly.
