# Shared TestFlight CLI

`bin/testflight` is a dependency-free Node 22+ command for macOS/Xcode. The dotfiles
zsh setup already adds `~/.config/dotfiles/bin` to PATH. No pnpm/npm wrapper is
needed. Clone/install this dotfiles repository at `~/.config/dotfiles` on another
release machine, or add its `bin` directory to PATH.

```sh
cd ~/www/hilma-workspace # also isum-workspace or zenpl.us
testflight config
testflight check
testflight release --dry-run
testflight release
testflight status 2.1.0 99
testflight whats-new --all
# Or select a checkout explicitly:
testflight --repo ~/www/isum-workspace check
```

The release command defaults to `origin/main`, fetches origin, requires the selected
commit to be on an origin branch, builds in a detached worktree, allocates a build
number from processed builds and raw uploads, validates the archive, uploads,
pushes an annotated tag, and waits up to 30 minutes for internal availability.
`--dry-run` archives and exports locally, without uploading or tagging.
`--ref`, `--version`, `--no-wait`, and `--allow-provisioning-updates` retain their
existing meanings. Provisioning updates are opt-in. Uploading, external testing,
and modifying signing accounts are separate actions; do not run a release to test
the CLI itself.

## Project configuration

Each project owns `config/testflight.json` with `schemaVersion: 1`. See the three
profiles under `tests/fixtures` for complete examples. Repository paths are relative
to the project root. Commands work in subdirectories and Git worktrees.

- Identity: `name`, `bundleId`, `teamId`, `scheme`, `target`, `configuration`, `appName`.
- Xcode input: exactly one of `workspace` or `project`, plus `appDir` for change summaries.
- Release policy: `tagPrefix`, `artifactDir`, `exportOptions`, `uploadOptions`.
- Credentials: `tokenFile` (supports `~/`) and `secretsFile` containing only `op://`
  references named `keyId`, `issuerId`, and `privateKey`.
- Optional checks: `podsDir`, `requiredFiles`, `preflight` commands with an argument
  array and repository-relative `cwd`, `archiveFiles`, and expected signed `entitlements`.

Preflight commands are trusted repository code, run in the selected commit's clean
worktree. They must succeed before archiving. The selected ref must contain the same
config as the invoking checkout; when releasing a ref with different policy, check
out that ref first. Old refs predating this config require their original tooling.
Export plists remain in each project and must disable automatic build renumbering.

Existing conventions are preserved: Hilma uses an AppStore workspace and Pods;
iSum uses a Release project and search tests; Calorie uses a Release project, Swift
core tests, bundled database checks, and signed iCloud KVS entitlement checks. Hilma
and iSum use `testflight/<version>-<build>` tags; Calorie uses
`testflight/calorie-<version>-<build>`.

## Credentials and outcomes

The configured token file is the only file fallback. An explicit
`OP_SERVICE_ACCOUNT_TOKEN` takes precedence. Legacy per-project secret-file env
variables, `OP_TOKEN_FILE`, and `HILMA_OP_TOKEN_FILE` do not override this CLI's
profile. Never put raw credentials into the profile or Git. `testflight check`
validates formats only; it does not prove Apple permissions or local signing.

Secrets are loaded using `op`, validated, written to a private temporary key file,
and removed after the foreground child exits, including forwarded termination.
The release child does not inherit the 1Password service-account token. A crash or
SIGKILL can leave `testflight-*` temporary directories; remove them only after
checking that no active release uses them. API JWTs are regenerated per request,
including retries, so a long archive or processing wait cannot outlive its token.

Artifacts and logs stay in the configured project directory. `release.json` records
the app SHA, dotfiles Git revision, profile, allocation, upload outcome, tag, and
processing result. Upload success, processing success, and internal group
availability are distinct. If upload outcome is ambiguous, use `testflight status`
before rerunning. Status exits 0 for internal availability, 2 for pending/unavailable,
and 1 for errors. It does not prove tester membership or installation.

## Tests

```sh
node --test ~/.config/dotfiles/scripts/testflight/tests/*.test.mjs
```

Tests use generated keys, fake tools, local Git remotes, and mocked Apple responses.
They exercise all three profiles, archive/export and upload/tag/status paths,
project-check failures, credential cleanup/redaction, exact app identity, pagination,
allocation, token renewal, and beta-group availability. They never upload to Apple.
The fixture profiles must be updated alongside intentional project policy changes.
