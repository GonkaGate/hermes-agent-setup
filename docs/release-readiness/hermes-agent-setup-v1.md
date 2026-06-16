# Hermes Agent Setup v1 Release Readiness

## Summary

`@gonkagate/hermes-agent-setup` now ships the full public onboarding runtime
for the v1 Hermes contract:

- public entrypoint: `npx @gonkagate/hermes-agent-setup`
- installed bin: `hermes-agent-setup`
- canonical integration path: `custom_providers[name=gonkagate]` with
  `model.provider = custom:gonkagate`
- canonical base URL: `https://api.gonkagate.com/v1`
- latest-only Hermes floor and qualification baseline: `v2026.5.16` /
  `v0.14.0`

The current checked-in allowlist includes these artifact-backed models:

- `moonshotai/kimi-k2.6` (recommended default)
- `minimaxai/minimax-m2.7`
- `qwen/qwen3-235b-a22b-instruct-2507-fp8`

## Qualification Sources

Checked-in qualification artifacts live under:

`docs/launch-qualification/hermes-agent-setup/<hermes-release-tag>/<model-slug>.md`

Maintainer tooling for new or refreshed qualification evidence lives under:

- `scripts/launch-qualification/prepare-clean-home.mjs`
- `scripts/launch-qualification/build-artifact.mjs`
- `scripts/launch-qualification/validate-artifacts.mjs`

Current checked-in artifacts:

- `docs/launch-qualification/hermes-agent-setup/v2026.5.16/minimaxai-minimax-m2-7.md`
- `docs/launch-qualification/hermes-agent-setup/v2026.5.16/moonshotai-kimi-k2-6.md`
- `docs/launch-qualification/hermes-agent-setup/v2026.5.16/qwen-qwen3-235b-a22b-instruct-2507-fp8.md`

## FR Coverage Map

This release note ties the shipped runtime back to FR0 through FR10 and the
Launch Readiness section of the PRD:

- FR0-FR3: public entrypoint, Node floor, platform guardrails, Hermes path
  resolution, and the named custom-provider config surface are implemented in
  `src/cli/`, `src/runtime/`, `src/hermes/`, and the CLI/runtime tests.
- FR4-FR7 plus the latest-only adaptation: shared-key, matching provider,
  auth-pool, normalized-read, Hermes version floor, and review-plan behavior
  are implemented in `src/hermes/`, `src/runtime/`, `src/planning/`,
  `src/ui/`, and the conflict-classification tests. Legacy endpoint paths such
  as `OPENAI_BASE_URL` are no longer managed or cleaned by the helper.
- FR8-FR9: live catalog access, artifact-backed model qualification, hidden key
  prompt, model picker, config/env write planning, backups, rollback, and
  consolidated review are implemented in `src/gonkagate/`, `src/ui/`,
  `src/writes/`, `src/io/`, and the phase-three/phase-four/e2e tests.
- The catalog proof covers the canonical `GET /v1/models` URL, Bearer auth,
  response-shape validation, retryable 5xx/429 handling, quota-shaped terminal
  failures, checked-in qualification intersection, ignoring unqualified live
  entries, and pre-write aborts before Hermes file mutation.
- FR10 and Launch Readiness: checked-in launch qualification artifacts,
  validation tooling, public docs, package/CLI truthfulness, mirrored skill
  sync, and contract tests now describe the shipped helper rather than a
  scaffold.

## Release Checklist

- `npm run ci`
- `npm pack --dry-run`
- `npm run qualification:artifact:validate`
- confirm the current checked-in allowlist still matches the latest-only Hermes
  baseline and live GonkaGate catalog
- confirm Linux, macOS, and WSL2 evidence is recorded in the artifact or that
  an explicit signed-off exception exists before GA
- confirm `README.md`, `AGENTS.md`, `docs/`, `package.json`,
  `src/constants/contract.ts`, `test/`, and mirrored skills describe the same
  shipped truth

## Residual Non-Goals

v1 still does not claim:

- arbitrary custom base URL support
- shell profile mutation
- native Windows launch support
- direct `auth.json` credential-pool mutation
- billing or first-request readiness proof from `/v1/models` alone
