# How It Works

`@gonkagate/hermes-agent-setup` is the shipped onboarding helper for
configuring local `hermes-agent` to use GonkaGate.

The primary UX is:

```bash
npx @gonkagate/hermes-agent-setup
```

## Current State

The runtime is implemented and shipped.

Today the repository ships:

- the public CLI and both bin entrypoints
- Hermes preconditions, path resolution, normalized reads, conflict
  classification, catalog access, model selection, write planning, backups,
  rollback, and success/error UX under `src/`
- checked-in launch qualification artifacts for the latest-only Hermes release
- docs, contract tests, and mirrored contributor skills

## Install Flow

1. Check Node, TTY, supported platform, Hermes availability, Hermes version
   floor, and managed-write blockers before prompting for anything.
2. Resolve the active Hermes config context through `hermes config path`,
   `hermes config env-path`, and optional `--profile <name>`.
3. Read `config.yaml`, `.env`, `auth.json`, and `cron/jobs.json`, then build a
   latest-only normalized Hermes view with `${VAR}` expansion for current
   supported surfaces.
4. Classify shared `OPENAI_API_KEY`, non-managed `providers:` /
   `custom_providers` conflicts, and matching `auth.json` credential-pool
   conflicts before any secret prompt or write plan is built.
5. Prompt for a hidden GonkaGate API key and validate the `gp-...` shape
   before any network call.
6. Call `GET /v1/models` against `https://api.gonkagate.com/v1`, classify
   terminal auth versus retryable failures, and use the live catalog as the
   model source of truth.
7. Pick one live model returned by GonkaGate. Interactive mode keeps the model
   picker visible; non-interactive flows choose the live default or first
   returned model.
8. Build one deterministic pre-write review that includes planned config
   changes and blocking conflicts. The old helper-managed direct custom model
   config is auto-migrated to `gonkagate`; legacy endpoint paths are
   not cleaned or migrated by the helper.
9. Create same-run backups, write `config.yaml` first, write `.env` second,
   and roll back `config.yaml` by pre-run state if the later `.env` write
   fails.
10. Print the final summary, including target paths, applied cleanup, and the
    optional one-command Hermes smoke test. The summary still reminds users
    that `/v1/models` proved auth and catalog visibility only.

## Product Boundaries

The helper intentionally stays narrow:

- it owns the GonkaGate onboarding path, not general Hermes bootstrap
- it manages only `providers.gonkagate.base_url`,
  `providers.gonkagate.key_env`,
  `providers.gonkagate.transport`,
  `providers.gonkagate.discover_models`,
  `providers.gonkagate.models`, `model.provider`,
  `model.default`, and `.env` `GONKAGATE_API_KEY`, plus cleanup of the old
  helper-managed direct custom fields under `model`
- it does not mutate `auth.json` credential pools
- it does not mutate shell profiles
- it does not accept arbitrary custom base URLs

Matching custom credential pools remain a blocking manual-resolution case in
v1. Non-managed matching `providers:` / `custom_providers` entries and
duplicate matching entries are blocking
manual-resolution cases; the helper manages only the named GonkaGate provider
entry.

## Model Selection And Verification

The runtime is live-catalog-first:

- `GET /v1/models` is the source of truth for selectable model IDs
- every valid live model returned by GonkaGate is eligible for the picker and
  written provider model list
- checked-in launch qualification artifacts under
  `docs/launch-qualification/hermes-agent-setup/` are maintainer evidence, not
  a runtime allowlist
- `GET /v1/models` is an auth plus live-catalog signal, not proof of prepaid
  balance or end-to-end readiness for the first billable request

Current proof coverage for the catalog boundary:

- `test/catalog-client.test.ts` verifies the canonical
  `https://api.gonkagate.com/v1/models` URL, Bearer auth, malformed payload
  rejection, terminal auth failures, retryable 5xx and 429 behavior, quota
  shaped failures, retry exhaustion, and live model metadata parsing.
- `test/qualified-models.test.ts` verifies that live catalog models do not need
  checked-in qualification artifacts.
- `test/e2e-onboard.test.ts` verifies catalog failures abort before Hermes
  files are written.

Use the maintainer scripts under `scripts/launch-qualification/` to prepare
clean-home qualification runs, build the checked-in artifact, and validate the
artifact tree.
