# @cra-ready/cli

## 0.1.1

### Patch Changes

- aa9f2a9: Production-readiness pass. Migrate the CLI from a hand-rolled `process.argv`
  switch to [`commander`](https://github.com/tj/commander.js) so each subcommand
  has a real `--help` page and `--version` reports the actual `package.json`
  version. Add ESLint + Prettier + Husky tooling, full GitHub Actions CI on
  Node 20 and 22, and a Changesets-driven npm release flow with provenance.
