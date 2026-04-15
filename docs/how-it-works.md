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
- checked-in launch qualification artifacts for the pinned Hermes release
- docs, contract tests, and mirrored contributor skills

## Install Flow

1. Check Node, TTY, supported platform, Hermes availability, and managed-write
   blockers before prompting for anything.
2. Resolve the active Hermes config context through `hermes config path`,
   `hermes config env-path`, and optional `--profile <name>`.
3. Read `config.yaml`, `.env`, `auth.json`, and `cron/jobs.json`, then build a
   release-pinned normalized Hermes view that includes `${VAR}` expansion and
   legacy root-level `provider` / `base_url` migration into `model.*`.
4. Classify shared `OPENAI_API_KEY`, `OPENAI_BASE_URL`, matching
   `custom_providers` / `providers:`, and matching `auth.json` credential-pool
   conflicts before any secret prompt or write plan is built.
5. Prompt for a hidden GonkaGate API key and validate the `gp-...` shape
   before any network call.
6. Call `GET /v1/models` against `https://api.gonkagate.com/v1`, classify
   terminal auth versus retryable failures, and intersect the live catalog with
   checked-in launch qualification artifacts.
7. Pick one qualified live model. Interactive mode keeps the model picker
   visible; single-option flows may auto-select that one qualified model.
8. Build one deterministic pre-write review that includes planned config
   changes, planned `.env` cleanup, takeover confirmations, and matching
   provider scrub actions.
9. Create same-run backups, write `config.yaml` first, write `.env` second,
   and roll back `config.yaml` by pre-run state if the later `.env` write
   fails.
10. Print the final summary, including target paths, applied cleanup, and the
    reminder that `/v1/models` proved auth and catalog visibility only.

## Product Boundaries

The helper intentionally stays narrow:

- it owns the GonkaGate onboarding path, not general Hermes bootstrap
- it manages only `model.provider`, `model.base_url`, `model.default`, and
  `OPENAI_API_KEY`, plus conflict-only cleanup allowed by the PRD
- it does not mutate `auth.json` credential pools
- it does not mutate shell profiles
- it does not accept arbitrary custom base URLs

Matching custom credential pools remain a blocking manual-resolution case in
v1. Matching provider entries are scrubbed only when one on-disk entry can be
cleaned within the allowed field set and the user confirms the consolidated
review.

## Qualification And Verification

The runtime is curated-model-first:

- only models with checked-in artifacts under
  `docs/launch-qualification/hermes-agent-setup/` are eligible
- the helper still requires those models to remain visible in the live
  `/v1/models` catalog before offering them
- `GET /v1/models` is an auth plus live-catalog signal, not proof of prepaid
  balance or end-to-end readiness for the first billable request

Use the maintainer scripts under `scripts/launch-qualification/` to prepare
clean-home qualification runs, build the checked-in artifact, and validate the
artifact tree.
