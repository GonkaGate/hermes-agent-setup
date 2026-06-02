# Hermes Latest Contract Adaptation

Status: draft  
Last updated: 2026-06-02  
Verified upstream compatibility: Hermes Agent `v2026.5.29.2` / Hermes
`v0.15.2`  
Minimum supported release remains Hermes Agent `v2026.5.16` / Hermes `v0.14.0`

## Purpose

Adapt `@gonkagate/hermes-agent-setup` from a release-pinned compatibility
helper into a latest-only onboarding helper for the current Hermes config
contract.

The helper remains narrow: it configures GonkaGate as the primary
OpenAI-compatible Hermes endpoint. It must not become a legacy Hermes config
migration tool.

## Decisions

- The minimum supported Hermes release is `v2026.5.16` / `0.14.0`.
- Older Hermes versions fail during preflight before secret prompts, catalog
  requests, or file writes.
- The supported endpoint contract is `config.yaml` `model.provider`,
  `model.base_url`, `model.default`, and
  `model.api_key = ${GONKAGATE_API_KEY}`.
- The supported secret contract is `.env` `GONKAGATE_API_KEY`.
- `OPENAI_BASE_URL`, `LLM_MODEL`, root-level `provider` / `base_url`, and
  legacy `custom_providers` are not supported configuration paths for this
  helper.
- The helper must not clean, rewrite, block on, or present review items for
  `OPENAI_BASE_URL`.
- Current Hermes-owned surfaces that can still compete with the helper-managed
  endpoint remain safety checks: `model.api`, incompatible `model.api_mode`,
  matching auth pools, cron jobs with direct `base_url`, and shared
  `OPENAI_API_KEY` reuse surfaces. Shared `OPENAI_API_KEY` state is no longer
  a helper takeover blocker because the GonkaGate main path uses the dedicated
  `GONKAGATE_API_KEY`.
- Launch qualification must be refreshed against `v2026.5.16` before release
  docs or model artifacts claim that baseline.

## Non-Goals

- Supporting Hermes releases older than `v2026.5.16`.
- Migrating root-level Hermes provider fields into `model.*`.
- Repairing or deleting legacy `OPENAI_BASE_URL` values from user files or the
  inherited shell environment.
- Automatically migrating or scrubbing legacy provider registries.
- Expanding v1 runtime verification beyond the existing bounded
  GonkaGate catalog and launch-qualification contract.

## Implementation Slices

1. Add a Hermes version floor in preflight.
2. Remove `OPENAI_BASE_URL` from conflict classification, review planning,
   write planning, success text, and tests.
3. Tighten provider-registry handling so the helper does not silently migrate
   legacy provider entries.
4. Refresh launch qualification artifacts for `v2026.5.16`.
5. Reconcile public docs, release-readiness notes, and mirrored contributor
   guidance after runtime and qualification evidence are complete.

## Acceptance Criteria

- Running the helper with Hermes below `0.14.0` fails before prompting for a
  GonkaGate key.
- Running the helper with file-backed or inherited `OPENAI_BASE_URL` does not
  create blocking findings, confirmation items, advisories, or env cleanup.
- The helper still writes only `model.provider`, `model.base_url`,
  `model.default`, `model.api_key = ${GONKAGATE_API_KEY}`, and `.env`
  `GONKAGATE_API_KEY` for the primary onboarding path.
- `npm run ci` passes after code, tests, docs, and qualification metadata are
  reconciled.
