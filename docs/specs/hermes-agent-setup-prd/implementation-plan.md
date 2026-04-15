# Implementation Plan: Full PRD Delivery for `@gonkagate/hermes-agent-setup`

> Historical planning document. The shipped runtime, public docs, launch
> qualification artifacts, and release-readiness note describe current
> repository truth.

Status: draft  
Last updated: 2026-04-15  
Source PRD: [`spec.md`](./spec.md)

## Overview

This plan breaks the approved PRD into ordered, verifiable implementation
tasks for turning the current scaffold into a shipped GonkaGate onboarding
helper for `hermes-agent`. The work is sequenced to keep repository truth
honest at every stage: first lock the runtime seams and test harness, then
build read-side safety and write-side correctness, then flip public docs and
release surfaces only after the runtime and qualification evidence exist.

## Architecture Decisions

- Keep [`src/cli.ts`](../../../src/cli.ts) thin and move the real onboarding
  flow into explicit modules for preconditions, Hermes path resolution,
  normalized reads, conflict planning, GonkaGate catalog access, write
  planning, and UX output.
- Treat Hermes normalized config semantics as a deliberate release-pinned
  compatibility adapter for the qualified upstream release, not as a
  future-proof schema abstraction.
- Compute one deterministic pre-write plan before mutating any file:
  preconditions -> read -> classify conflicts -> prompt for secret ->
  fetch models -> choose model -> review -> backup -> write `config.yaml` ->
  write `.env` -> rollback if needed.
- Source the user-visible model picker from checked-in launch qualification
  artifacts plus live `/v1/models` intersection; do not freeze launch model ids
  inside the PRD itself.
- Keep scaffold messaging in public docs and CLI until the end-to-end flow,
  tests, and launch qualification evidence are complete.

## Repository Truth To Preserve

- The repository is still a scaffold until the runtime is actually shipped.
- The primary public entrypoint remains
  `npx @gonkagate/hermes-agent-setup`.
- The installed primary bin remains `hermes-agent-setup`.
- The canonical integration path remains `provider: custom`.
- The canonical GonkaGate base URL remains `https://api.gonkagate.com/v1`.
- GonkaGate secrets belong in `~/.hermes/.env`, not `config.yaml`.
- Shell profile mutation and arbitrary custom base URLs stay out of scope.
- Launch support remains Linux, macOS, and WSL2 only.
- Public positioning must stay truthful about current GonkaGate availability
  boundaries, including the non-U.S. launch positioning captured in
  [`AGENTS.md`](../../../AGENTS.md).
- Mirrored contributor skills under `.agents/skills/` and `.claude/skills/`
  must stay aligned.
- Any task that changes package metadata, public CLI behavior, docs, or
  mirrored skills must finish with `npm run ci`.

## Task List

### Phase 1: Foundation

- [ ] Task 1: Replace the scaffold-only command shell with a real onboarding
      command contract.
- [ ] Task 2: Build a fixture-driven Hermes and GonkaGate test harness.
- [ ] Task 3: Implement runtime preconditions and Hermes path resolution.

## Task 1: Replace the scaffold-only command shell with a real onboarding command contract

**Description:** Introduce the real CLI shape for the future helper while
keeping the entrypoint thin. This task should define the command surface,
shared runtime constants, and typed error/result categories the rest of the
implementation will depend on.

**Acceptance criteria:**

- [ ] [`src/cli.ts`](../../../src/cli.ts) delegates to a dedicated onboarding
      command module instead of hardcoded scaffold output.
- [ ] The public CLI supports explicit `--profile <name>` and preserves both
      `hermes-agent-setup` and `gonkagate-hermes-agent-setup` bin entrypoints.
- [ ] Shared domain constants and result/error types cover the canonical base
      URL, supported platforms, helper-managed config surface, and non-success
      categories from the PRD.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] CLI contract tests pass: `npm test`
- [ ] Manual check: `npm run dev -- --help` shows the real command shape and
      `--profile`
- [ ] Full repo contract passes after public CLI text changes: `npm run ci`

**Dependencies:** None

**Files likely touched:**

- `src/cli.ts`
- `src/constants/contract.ts`
- `src/commands/onboard.ts`
- `src/domain/runtime.ts`
- `test/cli.test.ts`

**Estimated scope:** M

## Task 2: Build a fixture-driven Hermes and GonkaGate test harness

**Description:** Add reusable fixtures and helpers that let the repository test
realistic Hermes homes, Hermes CLI responses, and GonkaGate `/v1/models`
responses without depending on live external state during normal CI.

**Acceptance criteria:**

- [ ] Add fixture directories for clean homes, missing `config.yaml`, malformed
      YAML, managed installs, shared-key conflicts, named-provider conflicts,
      auth-pool conflicts, and cron-job conflicts.
- [ ] Add Hermes CLI doubles for `hermes config path`, `hermes config env-path`,
      profile-aware resolution, and managed-write failure paths.
- [ ] Add HTTP doubles for `/v1/models` success, terminal auth/access failures,
      malformed payloads, retryable `5xx` failures, and zero qualified
      intersection.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Fixture-backed tests pass: `npm test`
- [ ] Manual check: one dry-run test can exercise a fake Hermes home and fake
      `/v1/models` server end to end

**Dependencies:** Task 1

**Files likely touched:**

- `test/fixtures/**`
- `test/helpers/**`
- `test/cli.test.ts`
- `scripts/run-tests.mjs`

**Estimated scope:** M

## Task 3: Implement runtime preconditions and Hermes path resolution

**Description:** Make the helper fail fast before any secret prompt or write
when the runtime environment is unsupported. This task owns Node floor checks,
TTY requirements, supported platform boundaries, Hermes presence detection,
profile-aware path discovery, and managed-install abort behavior.

**Acceptance criteria:**

- [ ] The helper exits before prompting for a secret when the Node floor, TTY,
      supported platform, or Hermes presence check fails.
- [ ] Target config and env paths resolve through public Hermes seams
      (`hermes config path`, `hermes config env-path`) plus explicit
      `--profile`, without parsing Hermes internal state files directly.
- [ ] Managed installs and upstream-blocked writes are detected and surfaced as
      explicit unsupported states.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Preconditions and path-resolution tests pass: `npm test`
- [ ] Manual check: fixture-backed dry runs cover default context,
      `HERMES_HOME`, sticky profile behavior, explicit `--profile`, and managed
      installs

**Dependencies:** Task 1, Task 2

**Files likely touched:**

- `src/runtime/preconditions.ts`
- `src/hermes/cli.ts`
- `src/hermes/path-resolution.ts`
- `test/preconditions.test.ts`
- `test/path-resolution.test.ts`

**Estimated scope:** M

### Checkpoint: Foundation

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] The CLI can resolve a target Hermes context and abort safely before
      reading secrets on unsupported setups
- [ ] Human review confirms the module seams before deeper config work starts

### Phase 2: Read And Classify

- [ ] Task 4: Implement the release-pinned Hermes read model.
- [ ] Task 5: Implement shared-key and base-URL conflict classification.
- [ ] Task 6: Implement matching provider and auth-pool conflict planning.

## Task 4: Implement the release-pinned Hermes read model

**Description:** Build the read-side compatibility layer that turns raw Hermes
files plus inherited process environment into a normalized view suitable for
PRD conflict decisions. This layer is release-pinned to the qualified upstream
Hermes behavior and must stay explicit about that boundary.

**Acceptance criteria:**

- [ ] Raw loaders read resolved `config.yaml`, `.env`, `auth.json`, and
      `cron/jobs.json` while preserving source distinctions between file-backed
      values and inherited process environment.
- [ ] A normalized read adapter mirrors the qualified Hermes semantics needed
      by the PRD, including `${VAR}` expansion and legacy root-level
      `provider`/`base_url` migration into `model.*`.
- [ ] Malformed YAML and unreadable required conflict surfaces cause safe aborts
      before any write plan is built.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Normalized-read tests pass: `npm test`
- [ ] Manual check: fixture snapshots of the normalized view match expected
      outcomes for the pinned Hermes release

**Dependencies:** Task 2, Task 3

**Files likely touched:**

- `src/hermes/read-config.ts`
- `src/hermes/read-env.ts`
- `src/hermes/read-auth.ts`
- `src/hermes/read-cron.ts`
- `src/hermes/normalized-read.ts`
- `test/hermes-normalized-read.test.ts`

**Estimated scope:** L

## Task 5: Implement shared-key and base-URL conflict classification

**Description:** Encode the PRD finite matrix for shared `OPENAI_API_KEY`
takeover and the exact `OPENAI_BASE_URL` rules. The output of this task should
be typed conflict data that the review planner can render without guessing.

**Acceptance criteria:**

- [ ] The FR4 finite matrix is implemented for main model, OpenRouter, smart
      routing, auxiliary, delegation, fallback, cron, and voice-tooling
      surfaces that may consume shared `OPENAI_API_KEY`.
- [ ] `OPENAI_BASE_URL` conflicts are classified separately for resolved
      Hermes `.env` values and inherited shell/process values, including the
      exact-match canonical cleanup case and the non-canonical same-shell abort
      case.
- [ ] Conflict results enumerate only the matched surfaces and include job
      names or ids for matched cron entries when available.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Conflict-classification tests pass: `npm test`
- [ ] Manual check: sample fixtures produce the expected matched-surface list
      for takeover and `OPENAI_BASE_URL` scenarios

**Dependencies:** Task 4

**Files likely touched:**

- `src/hermes/conflicts/shared-openai-key.ts`
- `src/hermes/conflicts/openai-base-url.ts`
- `src/domain/conflicts.ts`
- `test/shared-openai-key-conflicts.test.ts`
- `test/openai-base-url-conflicts.test.ts`

**Estimated scope:** L

## Task 6: Implement matching provider and auth-pool conflict planning

**Description:** Detect competing named custom-provider state and matching
credential pools that could override the helper-managed GonkaGate path. This
task should turn those findings into deterministic blocking or scrub-only
review actions.

**Acceptance criteria:**

- [ ] Canonical URL matching works across both `custom_providers` and
      `providers:` shapes, including the PRD rules for allowed scrub fields and
      multi-match abort behavior.
- [ ] Matching credential pools in `auth.json` are detected as blocking
      conflicts and produce Hermes-owned manual resolution guidance instead of
      widening helper scope into auth mutation.
- [ ] The combined planner can merge model-field, provider-entry, auth-pool,
      and shared-key findings into one deterministic pre-write review model.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Matching-provider and auth-pool tests pass: `npm test`
- [ ] Manual check: a fixture with one scrubbable matching entry yields a
      limited diff that touches only the allowed field set

**Dependencies:** Task 4, Task 5

**Files likely touched:**

- `src/hermes/conflicts/matching-providers.ts`
- `src/hermes/conflicts/auth-pools.ts`
- `src/planning/review-plan-builder.ts`
- `test/matching-providers.test.ts`
- `test/auth-pools.test.ts`

**Estimated scope:** M

### Checkpoint: Read And Classify

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Every PRD abort condition that depends on read-side classification exists
      as typed review-plan data
- [ ] Human review confirms the normalized-read pin and finite detection matrix
      before write planning begins

### Phase 3: Model Selection And Input

- [ ] Task 7: Implement secret input and secret-safe interactive UX.
- [ ] Task 8: Implement the GonkaGate live catalog client.
- [ ] Task 9: Add the qualification artifact contract, allowlist loader, and
      model picker.

## Task 7: Implement secret input and secret-safe interactive UX

**Description:** Add the hidden interactive prompt for the GonkaGate key and
enforce the PRD rule that secrets never travel through argv, stdout, or
`config.yaml`.

**Acceptance criteria:**

- [ ] The main public flow accepts the API key only through a hidden interactive
      prompt and refuses to continue without a TTY.
- [ ] Key validation enforces the expected `gp-...` shape before any network
      call or file mutation.
- [ ] Errors and logs remain secret-safe: the raw key never appears in stdout,
      stderr, snapshots, or test fixtures.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Prompt and validation tests pass: `npm test`
- [ ] Manual check: a pseudo-TTY or fixture-backed interactive test proves the
      key stays hidden and invalid keys abort cleanly

**Dependencies:** Task 1, Task 2, Task 3

**Files likely touched:**

- `src/ui/prompts.ts`
- `src/validation/api-key.ts`
- `test/secret-prompt.test.ts`

**Estimated scope:** S

## Task 8: Implement the GonkaGate live catalog client

**Description:** Build the client that calls `GET /v1/models` against the
canonical GonkaGate endpoint, applies bounded retry/backoff only for retryable
failures, and returns typed outcomes for the rest of the flow.

**Acceptance criteria:**

- [ ] The client calls `GET /v1/models` with Bearer auth against
      `https://api.gonkagate.com/v1` and extracts machine-readable model ids
      from the response.
- [ ] Retry and backoff happen only for retryable transport or server failures;
      terminal auth/access failures and malformed responses fail immediately.
- [ ] The returned result type cleanly distinguishes usable live catalogs from
      terminal pre-write failures.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Catalog-client tests pass: `npm test`
- [ ] Manual check: stubbed success, `401`, malformed payload, and retryable
      `5xx` cases produce the expected typed outcomes

**Dependencies:** Task 2, Task 7

**Files likely touched:**

- `src/gonkagate/catalog-client.ts`
- `src/gonkagate/http.ts`
- `src/domain/catalog.ts`
- `test/catalog-client.test.ts`

**Estimated scope:** M

## Task 9: Add the qualification artifact contract, allowlist loader, and model picker

**Description:** Define how launch-qualified models are represented in the
repository, load that allowlist at runtime, intersect it with the live catalog,
and present a picker that never accepts arbitrary model ids.

**Acceptance criteria:**

- [ ] The repository gains a checked-in qualification artifact contract under
      `docs/launch-qualification/hermes-agent-setup/` that can express exact
      model ids, qualification date, and the pinned Hermes release.
- [ ] Runtime allowlist loading intersects the artifact-backed allowlist with
      the live `/v1/models` catalog and aborts when the intersection is empty.
- [ ] The interactive picker shows only qualified live models and records the
      selected model for the write plan and success summary.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Allowlist and picker tests pass: `npm test`
- [ ] Full repo contract passes after adding public qualification artifacts:
      `npm run ci`
- [ ] Manual check: removing a model from the live catalog or artifact removes
      it from the picker immediately

**Dependencies:** Task 7, Task 8

**Files likely touched:**

- `src/gonkagate/qualified-models.ts`
- `src/ui/model-picker.ts`
- `docs/launch-qualification/hermes-agent-setup/README.md`
- `test/qualified-models.test.ts`
- `test/model-picker.test.ts`

**Estimated scope:** M

### Checkpoint: Model Selection And Input

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] The helper can reach a qualified live model choice without mutating any
      file
- [ ] The qualification artifact format is agreed before real launch evidence
      is generated

### Phase 4: Mutation Engine

- [ ] Task 10: Implement the `config.yaml` mutation planner.
- [ ] Task 11: Implement the `.env` mutation planner and consolidated review
      rendering.
- [ ] Task 12: Implement backups, atomic writes, permissions, and rollback.

## Task 10: Implement the `config.yaml` mutation planner

**Description:** Plan and materialize the exact `config.yaml` changes owned by
the helper. This includes the minimal `model:` bootstrap for missing config,
helper-managed `model.*` writes, and conflict-only cleanup within the PRD
limits.

**Acceptance criteria:**

- [ ] The planner writes or updates `model.provider`, `model.base_url`,
      `model.default`, and canonical `model.api_mode` state without broad
      config ownership.
- [ ] Missing `config.yaml` produces only the exact minimal bootstrap contract
      from FR3 and does not materialize unrelated default sections.
- [ ] Existing unrelated config is preserved semantically, while conflicting
      `model.api_key`, `model.api`, incompatible `model.api_mode`, and allowed
      matching-entry scrub fields are handled according to FR6.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Config-planning tests pass: `npm test`
- [ ] Manual check: diff fixtures prove that unrelated sections survive and the
      helper-managed surface is the only semantic change

**Dependencies:** Task 4, Task 6, Task 9

**Files likely touched:**

- `src/writes/config-plan.ts`
- `src/writes/config-merge.ts`
- `src/writes/config-diff.ts`
- `test/config-plan.test.ts`
- `test/config-merge.test.ts`

**Estimated scope:** L

## Task 11: Implement the `.env` mutation planner and consolidated review rendering

**Description:** Plan the `.env` changes owned by the helper and render the
single pre-write review block required by the PRD. This task covers
`OPENAI_API_KEY`, file-backed `OPENAI_BASE_URL` cleanup, and the one-prompt
confirmation rule.

**Acceptance criteria:**

- [ ] The `.env` planner writes `OPENAI_API_KEY=<key>`, keeps unrelated env
      keys intact, and applies the PRD cleanup rules for file-backed
      `OPENAI_BASE_URL`.
- [ ] The review renderer shows one consolidated block with planned writes,
      cleanup actions, matched takeover surfaces, and any required confirmation.
- [ ] Declining the confirmation exits cleanly without touching any file.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Env-planning and review-flow tests pass: `npm test`
- [ ] Manual check: canonical and non-canonical `OPENAI_BASE_URL` cases render
      the correct review output and confirmation behavior

**Dependencies:** Task 5, Task 7, Task 10

**Files likely touched:**

- `src/writes/env-plan.ts`
- `src/ui/review.ts`
- `src/planning/confirmation.ts`
- `test/env-plan.test.ts`
- `test/review-flow.test.ts`

**Estimated scope:** M

## Task 12: Implement backups, atomic writes, permissions, and rollback

**Description:** Execute the write plan safely. This task owns timestamped
backup creation, per-file atomic writes, secret-file permissions, config-first
ordering, and rollback behavior when later steps fail.

**Acceptance criteria:**

- [ ] Existing `config.yaml` and `.env` files receive timestamped sibling
      backups using one shared UTC timestamp and collision-safe naming.
- [ ] Writes happen in PRD order: validate full plan -> create backups ->
      write `config.yaml` -> write `.env`.
- [ ] If `.env` fails after `config.yaml` succeeds, rollback restores or
      deletes `config.yaml` according to pre-run state and surfaces explicit
      recovery guidance if rollback also fails.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Write-safety and rollback tests pass: `npm test`
- [ ] Manual check: temporary-directory runs prove backup naming, owner-only
      permissions, and rollback semantics for both pre-existing and first-write
      files

**Dependencies:** Task 10, Task 11

**Files likely touched:**

- `src/io/backup.ts`
- `src/io/atomic-write.ts`
- `src/writes/execute-plan.ts`
- `test/write-safety.test.ts`
- `test/rollback.test.ts`

**Estimated scope:** M

### Checkpoint: Mutation Engine

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] The helper never touches a file before the full review plan is resolved
      and approved
- [ ] Backup and rollback behavior is verified for both existing-file and
      first-write scenarios

### Phase 5: Runtime Integration

- [ ] Task 13: Wire the end-to-end onboarding flow.
- [ ] Task 14: Expand comprehensive runtime regression coverage.

## Task 13: Wire the end-to-end onboarding flow

**Description:** Connect the whole runtime path into one cohesive command flow
that follows the PRD order and speaks clearly about success, aborts, and
recovery without overstating verification guarantees.

**Acceptance criteria:**

- [ ] One command path orchestrates preconditions, read-side classification,
      secret input, live catalog, qualified model selection, review,
      backups/writes, and final summary in the PRD order.
- [ ] Success output reports target config and env paths, applied cleanup
      actions, and next-step Hermes guidance without overstating `/v1/models`
      or billing readiness.
- [ ] Non-success output gives actionable guidance for missing Hermes, managed
      installs, blocking conflicts, shell-owned `OPENAI_BASE_URL`, and billing
      or quota follow-up.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] End-to-end runtime tests pass: `npm test`
- [ ] Manual check: a fixture-backed happy path completes with the exact
      `config.yaml` and `.env` shape promised by the PRD

**Dependencies:** Task 3, Task 6, Task 8, Task 9, Task 12

**Files likely touched:**

- `src/commands/onboard.ts`
- `src/cli.ts`
- `src/ui/success.ts`
- `src/ui/errors.ts`
- `test/e2e-onboard.test.ts`

**Estimated scope:** L

## Task 14: Expand comprehensive runtime regression coverage

**Description:** Lock the helper contract down with a broad test matrix so the
runtime can evolve without drifting away from the PRD. This is where the repo
stops being protected only by scaffold tests and starts being protected by real
behavior tests.

**Acceptance criteria:**

- [ ] The test matrix covers clean homes, missing config, malformed YAML,
      shared-key takeover confirmation, inherited and file-backed
      `OPENAI_BASE_URL`, matching named-provider conflicts, auth-pool aborts,
      backup/rollback paths, unsupported platforms, and explicit `--profile`.
- [ ] Fixtures cover default profile, sticky profile, custom `HERMES_HOME`,
      cron direct-endpoint conflicts, and smart-routing edge cases.
- [ ] CI remains practical for every PR while still pinning the helper runtime
      contract with meaningful regression coverage.

**Verification:**

- [ ] Tests pass: `npm test`
- [ ] Full repo contract passes: `npm run ci`
- [ ] Manual check: the coverage map can be reviewed against FR0-FR10 and the
      Launch Readiness section of the PRD

**Dependencies:** Task 13

**Files likely touched:**

- `test/**/*.test.ts`
- `test/fixtures/**`
- `scripts/run-tests.mjs`

**Estimated scope:** L

### Checkpoint: Runtime Complete

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] The onboarding flow is end-to-end functional under fixtures and no longer
      scaffold-only
- [ ] Human review approves flipping public docs and package messaging away
      from scaffold truth

### Phase 6: Qualification, Truthfulness, And Release Surfaces

- [ ] Task 15: Add the launch qualification harness and checked-in evidence.
- [ ] Task 16: Update public docs and package/CLI truthfulness surfaces.
- [ ] Task 17: Refresh public contract tests for the shipped helper.
- [ ] Task 18: Update mirrored contributor skills and skill contract tests.
- [ ] Task 19: Run the final readiness pass and release handoff checklist.

## Task 15: Add the launch qualification harness and checked-in evidence

**Description:** Build the repeatable smoke suite and check in the evidence
artifacts required by the PRD for every launch-qualified model. This is the
bridge between runtime implementation and actual launch readiness.

**Acceptance criteria:**

- [ ] A repeatable clean-home qualification flow exists for basic text,
      streaming, and harmless tool-use turns against the helper-configured
      Hermes path.
- [ ] Checked-in artifacts are created under
      `docs/launch-qualification/hermes-agent-setup/<hermes-release-tag>/<model-slug>.md`
      for every launch-qualified model.
- [ ] Each artifact includes the exact model id, qualification date, Hermes
      release tag and commit, sanitized resulting `config.yaml`/`.env` shape,
      and saved evidence excerpts.

**Verification:**

- [ ] Qualification harness runs successfully for each candidate model
- [ ] Full repo contract passes after adding checked-in artifacts:
      `npm run ci`
- [ ] Manual check: Linux, macOS, and WSL2 coverage is recorded or an explicit
      signed-off exception exists before GA

**Dependencies:** Task 9, Task 13, Task 14

**Files likely touched:**

- `scripts/launch-qualification/**`
- `docs/launch-qualification/hermes-agent-setup/**`
- `test/qualification/**`

**Estimated scope:** L

## Task 16: Update public docs and package/CLI truthfulness surfaces

**Description:** Replace scaffold-era public wording with shipped-helper truth,
but only after the runtime and qualification work are real. This task must
keep every public surface aligned with the actual implementation and launch
boundaries.

**Acceptance criteria:**

- [ ] [`README.md`](../../../README.md),
      [`AGENTS.md`](../../../AGENTS.md),
      [`docs/how-it-works.md`](../../how-it-works.md),
      [`docs/security.md`](../../security.md), and [`docs/README.md`](../../README.md)
      describe the shipped helper honestly instead of calling it an unimplemented scaffold.
- [ ] Package description, CLI help text, and contract constants align with the
      shipped helper while preserving the canonical base URL, `provider: custom`
      path, `.env` secret placement, unsupported managed installs, and
      non-U.S. public positioning.
- [ ] Compatibility alias behavior and release-please-facing package metadata
      remain consistent with the launch product.

**Verification:**

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Tests pass: `npm test`
- [ ] Full repo contract passes: `npm run ci`
- [ ] Manual check: README, AGENTS, docs, package text, and CLI help all tell
      the same product story

**Dependencies:** Task 13, Task 14, Task 15

**Files likely touched:**

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `src/constants/contract.ts`
- `package.json`

**Estimated scope:** L

## Task 17: Refresh public contract tests for the shipped helper

**Description:** Update the repository tests that currently pin scaffold truth
so they instead pin the shipped helper contract without becoming looser about
truthfulness.

**Acceptance criteria:**

- [ ] CLI tests assert the real helper behavior instead of scaffold-only output.
- [ ] Docs and package contract tests pin the shipped helper wording and launch
      invariants instead of the current scaffold wording.
- [ ] Test expectations continue to fail loudly if public surfaces drift away
      from the actual shipped runtime.

**Verification:**

- [ ] Tests pass: `npm test`
- [ ] Full repo contract passes: `npm run ci`
- [ ] Manual check: the updated tests still read like contract tests, not loose
      smoke tests

**Dependencies:** Task 16

**Files likely touched:**

- `test/cli.test.ts`
- `test/docs-contract.test.ts`
- `test/package-contract.test.ts`

**Estimated scope:** S

## Task 18: Update mirrored contributor skills and skill contract tests

**Description:** Bring the mirrored skill catalog up to date with the
post-scaffold repository truth. Any contributor skill that currently assumes
"runtime not implemented yet" must be rewritten carefully and mirrored in both
skill trees.

**Acceptance criteria:**

- [ ] Relevant skills under `.agents/skills/` are updated to describe the
      shipped helper accurately while preserving repo invariants and honest
      non-goals.
- [ ] Matching files under `.claude/skills/` stay byte-identical to the
      `.agents/skills/` copies unless an intentional divergence is explicitly
      documented.
- [ ] `test/skills-contract.test.ts` is updated to pin the new truthful skill
      language and retain the current anti-drift checks.

**Verification:**

- [ ] Tests pass: `npm test`
- [ ] Full repo contract passes: `npm run ci`
- [ ] Manual check: mirrored skill trees stay in sync and do not regress toward
      `opencode`-era wording

**Dependencies:** Task 16

**Files likely touched:**

- `.agents/skills/**`
- `.claude/skills/**`
- `test/skills-contract.test.ts`

**Estimated scope:** L

## Task 19: Run the final readiness pass and release handoff checklist

**Description:** Close the loop between code, docs, tests, and launch evidence.
This task is the final freeze gate before calling the PRD implemented.

**Acceptance criteria:**

- [ ] Full repository CI passes with the shipped runtime, updated public
      surfaces, mirrored skills, and checked-in qualification artifacts.
- [ ] Every allowlisted model has the required checked-in launch evidence for
      the pinned Hermes release.
- [ ] A short readiness note or checklist ties the implementation back to FR0
      through FR10, Launch Readiness, and residual non-goals.

**Verification:**

- [ ] Full repo contract passes: `npm run ci`
- [ ] Manual check: `npm pack --dry-run` includes the expected `bin`, `dist`,
      `docs`, and top-level package files
- [ ] Manual review confirms README, AGENTS, docs, CLI, package metadata,
      tests, skills, and qualification artifacts describe the same shipped
      truth

**Dependencies:** Task 15, Task 16, Task 17, Task 18

**Files likely touched:**

- `docs/launch-qualification/hermes-agent-setup/**`
- `docs/release-readiness/hermes-agent-setup-v1.md`

**Estimated scope:** M

### Checkpoint: Complete

- [ ] All acceptance criteria above are met
- [ ] `npm run ci` passes
- [ ] Launch qualification artifacts exist for every allowlisted model
- [ ] README, AGENTS, docs, CLI, package metadata, tests, and mirrored skills
      describe the same shipped truth
- [ ] Ready for implementation kickoff or agent-by-agent execution

## Parallelization Opportunities

- After Task 3, Task 7 and Task 8 can proceed in parallel because they share
  only the command contract and test harness.
- After Task 4, Task 5 and the first draft of Task 10 can proceed in parallel
  if Task 10 consumes only the normalized read model and not final conflict
  policy decisions yet.
- After Task 13, Task 15 and Task 16 can be prepared in parallel, but Task 16
  must not land until qualification evidence is real.
- Task 18 can run in parallel with Task 17 once Task 16 finalizes the
  post-scaffold truth that both tasks must encode.

## Risks And Mitigations

| Risk                                                                     | Impact | Mitigation                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hermes normalized-read behavior drifts after the pinned upstream release | High   | Keep the compatibility adapter explicit, back it with fixtures from the pinned release, and require requalification before claiming compatibility with newer Hermes releases |
| Shared `OPENAI_API_KEY` takeover is misclassified                        | High   | Encode the finite matrix directly from FR4, prefer safe aborts, and keep dedicated fixtures for every matched surface                                                        |
| YAML merge or scrub logic damages unrelated user config                  | High   | Limit the helper-managed surface, preserve unrelated semantics in tests, and keep backup plus rollback behavior mandatory                                                    |
| Live catalog and allowlist drift to zero launchable models               | Medium | Load allowlist from checked-in qualification artifacts and abort cleanly on empty intersection before any write                                                              |
| Public docs, package text, and skills drift away from shipped behavior   | Medium | Delay the doc flip until runtime completion, keep contract tests strict, and update mirrored skills in the same phase                                                        |

## Open Questions

No blocking product-definition questions remain in the PRD. These execution
inputs still need owners before the later phases complete:

- Exact initial launch-qualified model ids and the pinned Hermes release tag
  that will back the first checked-in qualification artifacts
- Where the qualification harness will run for macOS and WSL2 evidence if local
  developer environments are insufficient on their own
- The exact readiness-note format for the final handoff

## Verification

- [ ] Every task has explicit acceptance criteria
- [ ] Every task has an explicit verification step
- [ ] Dependencies are ordered so each phase leaves the repository in a working
      state
- [ ] No task is larger than `L`
- [ ] Checkpoints exist between every major phase
- [ ] The plan stays truthful to the current scaffold state
- [ ] The plan preserves `provider: custom`,
      `https://api.gonkagate.com/v1`, and `.env` secret storage
- [ ] Mirrored-skill maintenance is explicitly included
- [ ] The plan is ready for human review and execution
