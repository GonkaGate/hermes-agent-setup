# PRD: GonkaGate Onboarding Utility for Hermes Agent

Status: approved for implementation
Last updated: 2026-04-15
Owner: GonkaGate
Document type: product requirements document

## Summary

A small onboarding utility is needed for users of `hermes-agent` that configures
GonkaGate as the primary OpenAI-compatible endpoint without requiring manual
editing of `~/.hermes/config.yaml` and `~/.hermes/.env`.

The key decision in this PRD is to build a narrow helper for safe and obvious
initial setup, not a full installer/verifier in the style of
`openclaw-setup`.

Final v1 package name:
`@gonkagate/hermes-agent-setup`.

## Problem

`hermes-agent` already supports a custom provider through the first-class
`provider: custom` path, but current onboarding still leaves the user with
several manual decisions:

- understand that GonkaGate should be connected specifically as a custom
  OpenAI-compatible endpoint
- choose the correct `base_url`
- choose the correct model from the GonkaGate-supported set
- store the API key safely
- avoid damaging the existing `~/.hermes/config.yaml`
- avoid confusion about how the saved `model.base_url` relates to a possible
  `OPENAI_BASE_URL` in env-driven or auxiliary flows

For a technically strong user, this is not difficult. For an ordinary user,
this is already enough complexity to:

- make a config mistake
- save the secret in the wrong place
- choose an unsupported or already-removed model
- fail to understand why Hermes is not using the intended endpoint

## Background

This PRD is based on upstream `hermes-agent` `v2026.4.13` / `v0.9.0`, release
commit `1af2e18d408a9dcc2c61d6fc1eef5c6667f8e254` dated `2026-04-13`.

All statements below were verified against upstream source/docs as of
`2026-04-14`. If public docs and verified release source diverge, the product
contract in this PRD gives priority to behavior confirmed in source for that
exact release.

Source-backed facts:

- Hermes stores settings in `~/.hermes/config.yaml`, secrets in
  `~/.hermes/.env`, with support for `HERMES_HOME`.
- Hermes supports `provider: custom` as a first-class path for any
  OpenAI-compatible endpoint.
- Hermes already exposes public config seams through `hermes model`,
  `hermes config set`, `hermes config path`, `hermes config env-path`, and the
  global `--profile`.
- `hermes config set` routes API-key-like values to `.env` and non-secret
  values to `config.yaml`, but that seam does not provide a single transaction
  for a set of interrelated fields and by itself does not satisfy the helper's
  stricter safety policy for malformed config.
- Current Hermes docs position `config.yaml` as the primary saved contract for
  model/provider/base_url, but verified release source on `v2026.4.13` still
  reads, clears, and warns about `OPENAI_BASE_URL` in several
  compatibility/auxiliary paths. For the helper, this is an active conflict
  surface, even if parts of the docs describe the legacy env path more
  strongly.
- Hermes has `custom_providers` and a transition to the newer `providers:`
  shape, but that layer is still in compatibility mode.
- Hermes blocks mutation commands in managed installs through
  `HERMES_MANAGED` / `.managed` and performs secure writes for its own
  config/env files.
- Hermes has profiles, sticky `active_profile`, and explicit `--profile`, so
  target-home semantics cannot be reduced only to raw `HERMES_HOME` fallback.
- In the verified release runtime, `provider: custom` still depends on
  `model.api_key` / `model.api` and `model.api_mode`, so the helper cannot
  treat these fields as harmless residue after takeover.
- `OPENAI_API_KEY` in Hermes is used not only for the main custom endpoint,
  but also as a fallback for some OpenRouter resolution paths, direct-endpoint
  auxiliary/delegation/fallback flows without a separate explicit key, and
  OpenAI voice-tooling paths when `VOICE_TOOLS_OPENAI_KEY` is not set, so
  replacing it can affect more than just `model.*`.
- Hermes custom endpoint runtime can select a matching credential pool from
  `auth.json` before falling back to `OPENAI_API_KEY`, so competing custom
  credentials may live outside `config.yaml` too.
- Hermes cron jobs can store a per-job direct `base_url` in
  `~/.hermes/cron/jobs.json`; that path resolves auth through the same runtime
  provider flow and therefore shares the `OPENAI_API_KEY` blast radius.
- Hermes runtime and helpers read the inherited process environment alongside
  `~/.hermes/.env`, so a shell-exported `OPENAI_BASE_URL` can survive file
  cleanup and remain an active conflict surface.
- GonkaGate uses the OpenAI-compatible base URL
  `https://api.gonkagate.com/v1`, Bearer auth with `gp-...` keys, and a live
  catalog via `GET /v1/models`.
- As of `2026-04-15`, public GonkaGate docs and quickstart establish
  `GET /v1/models` as the authoritative source of truth for live model IDs.
  Exact launch-qualified IDs intentionally must live outside this PRD in
  versioned qualification artifacts; doc examples are not launch evidence.
- GonkaGate auth docs position `GET /v1/models` as the first auth smoke test,
  not as proof that a subsequent billable `POST /v1/chat/completions` will
  also succeed; prepaid-balance / quota state remains a separate failure
  surface after successful auth.
- GonkaGate advertises OpenAI-compatible chat completions and streaming, but
  tool calling is currently documented as partial / model-dependent capability.
- Current GonkaGate Terms explicitly prohibit platform use by individuals or
  entities in the United States of America and U.S. territories, so public
  product positioning must not imply launch support there.
- Hermes public docs still describe custom `fallback_model.base_url` +
  `api_key_env`, but the verified release fallback activation path does not
  consume `fallback_model.api_key_env` directly; the helper therefore must not
  rely on doc-only fallback credential-separation claims.

Inference:

- Upstream already provides sufficient seams for a narrow GonkaGate helper.
- But the helper must explicitly distinguish:
  - the current product path that we support
  - legacy Hermes compatibility paths that we only respect and avoid breaking
- The narrow helper in this PRD still requires one explicit release-pinned
  dependency: read-side conflict classification against Hermes normalized
  config semantics for the qualified upstream release.
- Therefore the v1 helper must not promise a stronger verify contract than is
  actually supported by the live catalog and our own launch qualification
  tests.

## Product Decision

Build only a narrower helper.

The utility must:

- simplify initial GonkaGate setup in Hermes into one clear scenario
- own only the minimally necessary configuration
- use stable/public Hermes seams wherever possible
- avoid unnecessary dependence on unstable internal Hermes schemas beyond a
  narrow, release-pinned read-side compatibility layer needed for conflict
  classification

The utility must not:

- try to become a general Hermes provider-management system
- replace `hermes model`, `hermes doctor`, or `hermes setup`
- promise deep runtime verification that upstream itself does not formalize

## Users

Primary user:

- a user who already has `hermes-agent` installed
- wants to quickly connect GonkaGate as the primary provider
- does not want to edit YAML or `.env` manually

Secondary user:

- a more experienced user who wants repeatable and safe GonkaGate setup on a
  new machine or in a new `HERMES_HOME`

## Supported Environments

Launch target for v1:

- users who are permitted to use GonkaGate under the current GonkaGate Terms
- user-managed Hermes installs on Linux, macOS, and WSL2
- interactive terminal contexts with a TTY available for a hidden secret
  prompt
- environments with compatible `node`; `npm`/`npx` are required for the
  primary public `npx` path, but not for an already-installed bin invocation

Explicitly unsupported in v1:

- native Windows
- Android / Termux
- managed NixOS / Homebrew installs where Hermes blocks local mutation
- users or organizations outside the current GonkaGate availability policy,
  including the United States of America and U.S. territories

## Goals

1. Reduce GonkaGate setup in Hermes to one short CLI flow.
2. Remove the need to manually edit `config.yaml` and `.env`.
3. Accept the `gp-...` key securely and without echoing it.
4. Restrict model choice to a product-qualified GonkaGate allowlist.
5. Change only the minimally necessary Hermes fields.
6. Preserve unrelated Hermes settings without loss.
7. Give the user a clear final outcome and next step.

## Non-Goals

1. Do not install `hermes-agent`.
2. Do not support arbitrary custom base URLs.
3. Do not become a general-purpose Hermes provider manager.
4. Do not manage named custom providers as the primary product scenario.
5. Do not mutate shell rc files.
6. Do not write to project-local `.env`.
7. Do not add a mandatory separate `verify` command in v1.
8. Do not rewrite or normalize the entire `config.yaml`.
9. Do not silently clean up arbitrary env-based provider configuration.

## Behavior Delta

Current behavior:

- the user runs `hermes model`, `hermes config set`, or manually edits
  `~/.hermes/config.yaml`
- the user chooses the URL, model, and secret-storage method manually
- the user figures out on their own whether the install has legacy residue
  such as `OPENAI_BASE_URL`

Desired behavior:

- the user runs one GonkaGate utility
- the user only enters an API key and chooses a model from the qualified live
  list
- the utility resolves the target Hermes config context itself, updates only
  the minimally required fields, writes the secret safely, and reports the
  final result

## Scope

### In scope for v1

- detect the `hermes` CLI in `PATH`
- resolve target config/env paths through the public Hermes surface and profile
  context, not through blind guessing about internal state
- explicit fail-fast on managed installs / upstream-blocked writes
- hidden interactive prompt for the `gp-...` API key
- live fetch of `GET /v1/models` against GonkaGate
- product-owned qualified allowlist over the live GonkaGate model catalog
- a picker only for models that are simultaneously:
  - product-qualified for launch
  - live in the current GonkaGate catalog
- use public Hermes path/read seams and selective write seams where they do
  not conflict with helper safety requirements
- a release-pinned Hermes-compatible normalized read view for conflict
  classification when raw file inspection or public seams alone are
  insufficient for helper safety decisions
- a helper-owned success snapshot after one successful run:
  - helper writes `OPENAI_API_KEY=<key>` to the resolved Hermes `.env`
  - helper writes `model.provider = "custom"`
  - helper writes `model.base_url = "https://api.gonkagate.com/v1"`
  - helper writes `model.default = <selected-model>`
  - helper itself does not persist the GonkaGate secret in `config.yaml`
  - helper clears helper-detected conflicting auth/protocol fields under
    `model` if they would override or make the GonkaGate path ambiguous:
    `model.api_key`, `model.api`, incompatible `model.api_mode`
- helper also resolves or aborts on helper-detected matching entries under
  `custom_providers` / `providers:` that point to the same canonical
  GonkaGate URL and would remain an active competing credential/protocol
  source after onboarding
- detection-only scan of the resolved `cron/jobs.json` for job-level direct
  endpoint overrides that would inherit the shared `OPENAI_API_KEY`
- detection and explicit abort UX for matching custom credential pools in the
  resolved `auth.json`; direct pool mutation is out of scope for v1
- a policy-level ban on persisting the GonkaGate secret in `config.yaml`;
  cleanup of existing conflicting secret-bearing fields in `config.yaml` is in
  scope
- create minimal user config when `config.yaml` is absent, if that can be done
  through a supported Hermes flow without a full bootstrap wizard
- detection and messaging for legacy `OPENAI_BASE_URL`, including inherited
  process-env state, if it is found in the existing install
- backup of files that will actually be modified before overwrite
- per-file atomic and permission-safe writes, including a helper-owned path
  for multi-field `config.yaml` mutation if the public Hermes seam does not
  provide the necessary safety semantics

The helper contract above is scoped to helper-owned writes at the time of its
successful completion. It is not a claim that later Hermes-owned flows such as
`hermes model` will preserve the same secret-placement invariant indefinitely.

### Out of scope for v1

- named custom providers UX
- fallback providers
- auxiliary provider routing
- migration of arbitrary third-party provider setups into GonkaGate
- attempts to automatically repair all broken Hermes config
- deep runtime health checks through Hermes internals
- a separate long-lived `verify` command
- broad cleanup of legacy env residue beyond explicit GonkaGate-owned conflict
  UX
- direct mutation of `auth.json` credential pools in v1

## Proposed UX

Final public entrypoint for v1:

```bash
npx @gonkagate/hermes-agent-setup
```

Installed bin name for users who install the package instead of using `npx`:

```bash
hermes-agent-setup
```

Compatibility alias may remain published:

```bash
gonkagate-hermes-agent-setup
```

Happy path:

1. The utility checks that `hermes` is installed and available.
2. The utility resolves the target config/env paths for the active Hermes
   context.
3. The utility checks that the target install is not in managed mode and that
   upstream will not block writes.
4. The utility reads the current `config.yaml` and `.env`, if they exist.
5. The utility asks for the `gp-...` key using a hidden prompt.
6. The utility makes an authenticated request to `GET /v1/models` at
   `https://api.gonkagate.com/v1` with bounded retry only for retryable
   network/server failures.
7. The utility intersects the live catalog with the product-owned qualified
   allowlist and shows a picker only from qualified live models.
8. If the live catalog is unavailable or the intersection is empty, the
   utility exits before writing with a clear message.
9. The utility builds a deterministic pre-write plan: target writes,
   matching-entry cleanup, `OPENAI_BASE_URL` resolution, and shared-secret
   takeover impact.
10. If the plan contains confirm-required destructive changes, the utility
    shows one consolidated review block and asks for confirmation once.
11. The utility backs up the files it will actually modify.
12. The utility writes the helper-managed config surface and `.env` with
    per-file atomic writes, rollback-safe ordering, and without falsely
    promising a true cross-file transaction.
13. The utility prints short success output, shows target config/env paths,
    lists helper-managed cleanup actions, and recommends running `hermes` or
    `hermes chat`. If the first billable request later fails with
    `insufficient_quota`, the helper must not mask that as a config bug and
    should route the user to billing/account-state triage.

## UX Rules

- Do not ask for the base URL.
- Do not accept an arbitrary model ID.
- Do not accept the API key via a CLI arg.
- Do not edit the shell profile.
- Do not write the secret to `config.yaml`.
- Do not touch unrelated sections of `config.yaml`.
- Do not turn the flow into a wizard with many screens.
- Do not rely on `OPENAI_BASE_URL` as the main GonkaGate config path.
- Do not remove legacy `OPENAI_BASE_URL` silently.

## Functional Requirements

### FR0. Delivery And Runtime Preconditions

V1 shipping path is the npm package `@gonkagate/hermes-agent-setup` with the
primary public entrypoint `npx @gonkagate/hermes-agent-setup`.

Helper must:

- verify the presence of compatible `node` before any onboarding steps
- treat `npm`/`npx` as acquisition preconditions only for the public
  `npx @gonkagate/hermes-agent-setup` path, not as universal runtime
  preconditions for an already-installed `hermes-agent-setup` bin
- check `node` against the package-supported floor `>=22.14.0`
- exit with install guidance before prompting for the secret if these
  dependencies are missing for the chosen invocation path
- not promise a flow like "you already have Hermes, so that is automatically
  sufficient" when runtime preconditions for the chosen launch path are not
  met

### FR1. Hermes Home Resolution

The utility must not guess the target home through raw filesystem heuristics
when the public Hermes CLI already knows the active profile/context.

Resolution order for v1:

1. If the helper is invoked with explicit `--profile`, it must pass that
   context through to the Hermes CLI for path resolution.
2. Otherwise, the helper must respect the current Hermes context, which
   already accounts for explicit `HERMES_HOME`, sticky active profile, and
   standard Hermes resolution.
3. For actual target paths, the helper must prefer `hermes config path` and
   `hermes config env-path` as public path seams.

v1 must not read or parse Hermes' internal `active_profile` file itself. If a
direct path override beyond `--profile` is needed later, that must be a
separate explicit UX decision, not hidden autodetection.

Public v1 CLI supports explicit `--profile <name>`.

### FR2. Hermes Presence Check

Before asking for the secret, the utility must verify that `hermes` is
available in `PATH`.

If Hermes is not installed, the utility must exit with instructions to install
Hermes, without side effects.

### FR3. Install Preconditions

The utility must fail fast before any changes if the target Hermes install is
in managed mode or if the upstream-supported write path reports that local
writes are forbidden.

If `config.yaml` is missing, the utility may create minimal user config without
running full `hermes setup`, if that can be done safely and without
bootstrapping unrelated settings.

The utility must not:

- run full `hermes setup` without an explicit user choice
- bootstrap unrelated Hermes settings
- manually write a broad `DEFAULT_CONFIG`

Exact v1 bootstrap contract when `config.yaml` is absent:

```yaml
model:
  provider: custom
  base_url: https://api.gonkagate.com/v1
  default: <selected-model>
```

The v1 helper creates no other top-level sections on first write.
`~/.hermes/.env` may be created from scratch, but only as a helper-owned secret
file for the resolved context.

### FR4. Secret Handling

The API key must be accepted only through a hidden interactive prompt.

The utility must:

- validate that the key looks like `gp-...`
- write it to `~/.hermes/.env` as `OPENAI_API_KEY=<key>`
- not write it to stdout
- not write it to `config.yaml`
- before writing, evaluate whether replacing the shared `OPENAI_API_KEY` would
  cause unintended takeover of other Hermes flows that fall back to
  `OPENAI_API_KEY`

If the helper detects existing non-GonkaGate state that may use the shared
`OPENAI_API_KEY` outside the main `model.*` path, the helper must:

- determine the affected surface only through a release-pinned finite
  detection matrix, not through open-ended heuristics
- for `v2026.4.13`, the detection matrix includes:
  - `main custom endpoint`: normalized main-model path where
    `model.provider == "custom"`, or `model.provider in {"", "auto"}` with
    non-empty `model.base_url`
  - `main OpenRouter fallback`: `model.provider in {"auto", "openrouter"}`
    when no usable dedicated `OPENROUTER_API_KEY` is present
  - `smart cheap route`: `smart_model_routing.enabled == true` and at least
    one of the following is true:
    - `cheap_model.provider == "openrouter"` when no usable dedicated
      `OPENROUTER_API_KEY` is present
    - non-empty `cheap_model.base_url` when there is no usable dedicated
      secret proven through `cheap_model.api_key_env`
    - `cheap_model.provider == "custom"` without an explicit non-empty
      `cheap_model.base_url`; in v1 this route is treated as an ambiguous
      shared-key surface and the helper must abort instead of guessing
  - `auxiliary OpenRouter override`: any
    `auxiliary.<task>.provider == "openrouter"` without a usable dedicated
    `OPENROUTER_API_KEY`
  - `auxiliary direct endpoint`: any non-empty
    `auxiliary.<task>.base_url` with empty `auxiliary.<task>.api_key`
  - `delegation direct endpoint`: non-empty `delegation.base_url` with empty
    `delegation.api_key`
  - `fallback OpenRouter route`: `fallback_model.provider == "openrouter"`
    without a usable dedicated `OPENROUTER_API_KEY`
  - `fallback direct endpoint`: any non-empty `fallback_model.base_url`
  - `cron OpenRouter override`: any job in the resolved
    `~/.hermes/cron/jobs.json` with `provider == "openrouter"` and no usable
    dedicated `OPENROUTER_API_KEY`
  - `cron direct endpoint`: any job in the resolved
    `~/.hermes/cron/jobs.json` with non-empty `base_url`
  - `OpenAI voice tooling`: `tts.provider == "openai"` or
    `stt.provider == "openai"` with empty `VOICE_TOOLS_OPENAI_KEY`
- explicitly list only the affected surfaces that matched this finite matrix;
  for cron jobs, the helper shows at least the job name or ID when available
- not continue silently
- continue only after explicit user takeover confirmation, or else exit
  without writing
- if the resolved `cron/jobs.json` exists but the helper cannot reliably read
  it while evaluating the shared-key blast radius, the helper must abort
- if the helper detects state outside this finite matrix and cannot prove that
  overwriting `OPENAI_API_KEY` will not change runtime behavior, it must exit
  without writing rather than do an optimistic overwrite

Default v1 policy: safe abort first. Explicit takeover confirmation is allowed
only when the helper can clearly enumerate the matched surfaces from the finite
matrix and the user confirms takeover in the interactive flow.

The v1 success path must not leave unresolved shared-secret ambiguity.

Dedicated-credential proof rules for v1:

- `main OpenRouter fallback` is considered isolated from shared
  `OPENAI_API_KEY` only if a usable `OPENROUTER_API_KEY` is visible in the
  resolved Hermes `.env` or inherited process environment at plan time
- `smart_model_routing.cheap_model.provider == "openrouter"` is considered
  isolated from shared `OPENAI_API_KEY` only if a usable `OPENROUTER_API_KEY`
  is visible in the resolved Hermes `.env` or inherited process environment at
  plan time
- `auxiliary.<task>.provider == "openrouter"` is considered isolated from
  shared `OPENAI_API_KEY` only if a usable `OPENROUTER_API_KEY` is visible in
  the resolved Hermes `.env` or inherited process environment at plan time
- a direct smart-route endpoint is considered isolated only if
  `cheap_model.api_key_env` is set and points to a usable secret visible to
  the helper in the resolved Hermes `.env` or inherited process environment at
  plan time
- `smart_model_routing.cheap_model.provider == "custom"` without an explicit
  non-empty `cheap_model.base_url` is treated as ambiguous and blocking in v1;
  the helper must not prove safety through implicit inheritance
- a direct auxiliary/delegation endpoint is considered isolated only if it has
  its own explicit non-empty `api_key` in helper-visible config
- `fallback_model.provider == "openrouter"` is considered isolated from shared
  `OPENAI_API_KEY` only if a usable `OPENROUTER_API_KEY` is visible in the
  resolved Hermes `.env` or inherited process environment at plan time
- `fallback_model.base_url` is always considered an affected shared-key
  surface in v1; the helper does not rely on non-release-pinned or doc-only
  semantics such as `api_key_env` to prove a separate credential boundary
- a cron job with `provider == "openrouter"` is considered isolated from
  shared `OPENAI_API_KEY` only if a usable `OPENROUTER_API_KEY` is visible in
  the resolved Hermes `.env` or inherited process environment at plan time

Pre-write review UX for v1:

- the helper computes one consolidated review plan before any write
- the helper shows at most one confirmation prompt for the whole run
- confirmation is required when at least one of the following is true:
  - shared `OPENAI_API_KEY` takeover affects one or more matched surfaces from
    the finite matrix
  - a non-empty non-canonical `OPENAI_BASE_URL` must be cleared
  - matching `custom_providers` / `providers:` entries contain auth/protocol
    fields that must be scrubbed
- if the only planned legacy cleanup is `OPENAI_BASE_URL` already equal to
  `https://api.gonkagate.com/v1`, no extra confirmation is required; the
  helper must still show that planned cleanup in the review summary and
  success output
- if the user declines the consolidated confirmation, the helper exits without
  writing any file

### FR5. Approved Live Model Selection

Model selection must not come from a bare hardcoded registry without runtime
validation.

v1 must:

- maintain a product-owned qualified allowlist of models that have passed
  launch verification for the Hermes use case
- fetch live `GET /v1/models` before writing
- use machine-readable model IDs from the live response as the runtime source
  of truth for intersection with the allowlist
- perform bounded retry/backoff only for retryable transport/server failures
  (`5xx`, transient network errors, and a retryable rate-limit class if it can
  be distinguished from quota failure)
- treat `401 invalid_api_key`, other terminal auth/access failures, unusable
  response shape, and an empty/inconsistent catalog as terminal pre-write
  failures
- show the user only the intersection of:
  - the qualified allowlist
  - the live catalog

If the live catalog is unavailable or the qualified intersection is empty, the
utility must stop before writing and explicitly explain the reason.

Launch-qualified allowlist policy for v1:

- concrete live model IDs are maintained outside this PRD in a versioned
  launch qualification artifact
- v1 may still launch with one or more qualified models, but the PRD does not
  freeze a live GonkaGate model ID as a durable product fact

Minimum Hermes smoke suite for inclusion of a model in the v1 allowlist:

- successful authenticated `GET /v1/models` where the model is visible in the
  live catalog
- successful basic Hermes text turn on a clean `HERMES_HOME`
- successful Hermes streaming turn on a clean `HERMES_HOME`
- successful Hermes tool-use turn with a harmless local tool on a clean
  `HERMES_HOME`
- no launch-blocking regressions in the path that the helper actually
  configures: `provider: custom` + `model.base_url` in `config.yaml` +
  `OPENAI_API_KEY` in `.env`

Launch qualification evidence required for every allowlisted model:

- exact Hermes release tag and commit under test
- exact GonkaGate model ID and qualification date
- sanitized clean-home artifacts showing the resulting `config.yaml` and `.env`
  shape after helper completion
- a saved transcript or log excerpt for:
  - a basic text turn
  - a streaming turn
  - a harmless tool-use turn
- recorded OS coverage for Linux, macOS, and WSL2, or an explicit signed-off
  exception before GA
- evidence must exist as a checked-in artifact under
  `docs/launch-qualification/hermes-agent-setup/<hermes-release-tag>/<model-slug>.md`
- `<model-slug>` is a filesystem-safe rendering of the exact GonkaGate model
  ID; the artifact body must still include the exact unslugged ID
- a release checklist may link to that checked-in artifact, but does not
  replace it; lack of the checked-in artifact means the model is not
  launch-qualified

### FR6. Config Mutation

The utility must prefer public Hermes path/read seams and use public write
seams only where they do not conflict with helper safety guarantees.

Read-side conflict classification in v1 is a deliberate release-pinned
dependency on Hermes behavior. The helper does not promise schema-agnostic
compatibility across future Hermes releases; it promises correctness only for
the launch-qualified Hermes release contract against which this PRD is pinned.

Managed surface for v1:

- `model.provider`
- `model.base_url`
- `model.default`
- `OPENAI_API_KEY`
- canonical main-path protocol selector:
  - compatible state is an empty / absent `model.api_mode`, or explicit
    `model.api_mode == "chat_completions"`
- conflict-only cleanup surface if existing values override or make the
  canonical GonkaGate path ambiguous:
  - `model.api_key`
  - `model.api`
  - any non-empty `model.api_mode` other than `"chat_completions"`
  - matching `custom_providers[].api_key`
  - matching `custom_providers[].key_env`
  - matching `custom_providers[].api_mode` when non-empty and not
    `"chat_completions"`
  - matching `providers.<name>.api_key`
  - matching `providers.<name>.key_env`
  - matching `providers.<name>.transport` when non-empty and not
    `"openai_chat"`
  - matching `providers.<name>.api_mode` when non-empty and not
    `"chat_completions"`
- read-only conflicting credential surface outside `config.yaml`:
  - matching `auth.json` credential pools under
    `credential_pool["custom:*"]` when their pool key resolves from a matching
    custom-provider entry for the canonical GonkaGate URL

Matching custom-provider entries means entries in either `custom_providers` or
`providers:` whose canonicalized URL resolves to
`https://api.gonkagate.com/v1` and which Hermes could still use as an active
credential/protocol source for the same endpoint after helper completion.

And it must preserve:

- other keys inside `model` if they do not conflict with the managed surface
- all unrelated top-level sections
- the semantics of unrelated user settings, but it does not have to preserve
  comments, key order, or byte-for-byte formatting of the original YAML

Helper must:

- use Hermes CLI primarily for path discovery and other public seams where
  they provide sufficient signal
- not write the GonkaGate secret through argv-bearing Hermes CLI mutation
  commands such as `hermes config set OPENAI_API_KEY ...`; a helper-owned
  atomic `.env` write is the only supported secret-persistence path for v1
- make runtime conflict decisions against a Hermes-compatible normalized read
  view equivalent to the release-pinned `load_config()`, including `${VAR}`
  expansion and legacy root-level `provider` / `base_url` migration into
  `model.*`
- treat this normalized read view as an explicit release-pinned compatibility
  contract for helper safety decisions, not as an implicit forever-guarantee
  from upstream docs
- separately inspect raw on-disk YAML for diff planning if needed, but raw
  file inspection alone is not a sufficient basis for conflict classification
- not use `hermes model` as the mutation path for v1 onboarding, because that
  flow is broader than our product and writes more than we need
- after helper completion, the canonical main-path protocol selector must be
  either absent / empty `model.api_mode`, or explicit `"chat_completions"`
- not leave stale `model.api_key` / `model.api` / incompatible
  `model.api_mode` (`"codex_responses"`, `"anthropic_messages"`, or any other
  non-empty value besides `"chat_completions"`) if they would override the
  helper-owned GonkaGate path
- not treat top-level `model.*` as the only active custom credential source;
  helper must inspect matching `custom_providers` / `providers:` compatibility
  state before claiming success
- not treat `config.yaml` + `.env` as a complete credential boundary; helper
  must also inspect matching custom credential pools in the resolved
  `auth.json`
- not persist the GonkaGate secret in `config.yaml`; clearing conflicting
  secret-bearing fields from config is allowed and required when they would
  override `.env`
- either scrub conflicting auth/protocol fields in matching custom-provider
  entries, or stop with explicit conflict UX; the helper must not leave an
  unresolved second credential source for the same canonical GonkaGate URL
- v1 must not mutate matching custom credential pools in `auth.json`; if such
  a pool contains a credential for the canonical GonkaGate URL, the helper
  aborts with explicit manual resolution guidance instead of widening scope
  into general credential management
- treat a helper-owned atomic merge-write for `config.yaml` as the preferred
  path for the `model.*` set if needed for:
  - one coherent update to multiple fields inside `config.yaml`
  - fail-fast behavior on malformed YAML
  - preserving unrelated sections without a broad rewrite

When directly mutating `config.yaml`, the helper must not normalize the whole
file, materialize legacy compatibility sections, or take ownership of
third-party provider internals.

If a comment-preserving merge turns out to be disproportionately complex and
unstable relative to Hermes upstream changes, v1 may rewrite the YAML file
entirely only if all of the following conditions hold:

- the existing file parsed successfully
- unrelated keys/values are preserved semantically
- the helper changes only its managed surface in meaning
- a backup is created before writing

Matching-entry cleanup policy for v1:

- if a matching entry already points to the canonical GonkaGate URL and does
  not contain competing auth/protocol selectors, the helper leaves it intact
- if a matching entry contains competing auth/protocol selectors, the helper
  may scrub only the conflicting fields after consolidated user confirmation
- scrub-and-continue is allowed only when the helper edits exactly one
  matching on-disk entry and the planned diff is limited to the allowed scrub
  surface
- preserved metadata fields may include identity/model metadata such as
  `name`, `provider_key`, the canonical URL field, `model`, `default_model`,
  `models`, `context_length`, and `rate_limit_delay`
- scrubbed fields are limited to credential/protocol selectors that can change
  active runtime behavior for the same canonical URL:
  `api_key`, `key_env`, incompatible `api_mode`, incompatible `transport`, and
  duplicate non-canonical URL aliases when present alongside the canonical URL
  field
- the helper never creates new named custom-provider entries, never renames
  them, and never deduplicates them in v1
- if the helper finds multiple matching on-disk entries across
  `custom_providers` and `providers:` for the canonical GonkaGate URL, v1
  aborts instead of selecting a winner or deduplicating them automatically
- if the helper cannot scrub a matching entry without deleting semantics
  outside this policy, it must abort instead of widening scope into general
  provider management

Matching credential-pool policy for v1:

- if a matching custom credential pool exists in the resolved `auth.json` and
  has one or more credentials, the helper treats it as an active competing auth
  source
- the helper does not scrub, rewrite, or rotate that pool in v1
- the helper aborts with manual resolution guidance that references
  Hermes-owned auth flows such as `hermes auth list` / `hermes auth remove`

### FR7. `OPENAI_BASE_URL` Conflict Handling

If `OPENAI_BASE_URL` is found in the resolved Hermes `.env` or inherited
process environment, the utility must treat it as an active runtime conflict
surface, not as harmless residue.

For this PRD, this is a release-pinned decision: verified Hermes source on
`v2026.4.13` dated `2026-04-13` still contains compatibility/auxiliary
handling for `OPENAI_BASE_URL`, even if parts of the public docs describe the
legacy env path as removed.

Helper must distinguish the source of conflict:

- a file-backed value in the resolved Hermes `.env`
- an inherited process-env value from the current shell/session

If inherited process-env `OPENAI_BASE_URL` is non-empty and does not equal
`https://api.gonkagate.com/v1`, the helper must:

- explicitly show that the conflict comes not from the helper-owned `.env`,
  but from the current shell/session environment
- not promise that it can clear this value itself
- require manual resolution before writes:
  - `unset OPENAI_BASE_URL` in the current shell and rerun
  - or start a fresh shell/session and rerun
- exit without writing rather than continue with same-shell ambiguity

If inherited process-env `OPENAI_BASE_URL` already equals
`https://api.gonkagate.com/v1`, the helper may continue without abort, but
must:

- explicitly show that this is a shell-owned value, not file-backed helper
  state
- not claim that the helper cleared it or took ownership of it
- explicitly warn that the same-shell runtime remains env-backed until the
  user `unset OPENAI_BASE_URL` or starts a fresh shell/session

If the file-backed `.env` value is non-empty and does not equal
`https://api.gonkagate.com/v1`, the utility must:

- warn the user that this value may continue to influence
  auxiliary/compatibility paths in Hermes runtime even after writing the
  GonkaGate endpoint to `config.yaml`
- not treat such a state as compatible with successful deterministic
  onboarding
- offer explicit resolution:
  - clear `OPENAI_BASE_URL` and continue
  - abort without writes
- not clear the value silently

If the file-backed `.env` value already equals
`https://api.gonkagate.com/v1`, the helper must treat it as legacy-compatible
residue and plan cleanup to empty by default, because the canonical saved
contract for the main endpoint is `config.yaml`, not an env override. That
exact-match cleanup does not require a separate prompt if there are no other
confirm-required conflicts, but the helper must explicitly show the planned
cleanup in the review summary and success output.

### FR8. Backup

Before the first helper-managed mutation of an existing `config.yaml` or `.env`
file, the utility must create a timestamped backup next to the original file.

Backups are required only for files that are actually changed.

Backup naming contract for v1:

- use one shared UTC timestamp per helper run in format `YYYYMMDDTHHMMSSZ`
- create sibling backups next to the original file
- backup filename format:
  - `config.yaml.bak.<timestamp>.hermes-agent-setup`
  - `.env.bak.<timestamp>.hermes-agent-setup`
- the helper never overwrites an existing backup path; if a collision somehow
  occurs, the helper aborts before writes
- for helper-created files that did not exist before the run, the helper
  records first-write state explicitly so rollback can delete them if a later
  step fails

### FR9. Write Safety

Writes must use upstream atomic write behavior whenever feasible.

If the helper is forced to write a secret-bearing file directly, the write
must be atomic whenever feasible, and owner-only permissions must be applied
to created/rewritten secret-bearing files without weakening existing security.

Exact write ordering for v1:

1. Resolve the full write plan and validate all abort conditions.
2. Create backups for every existing file that will change.
3. Atomically write `config.yaml` first.
4. Atomically write `.env` second.
5. If the `config.yaml` write fails, do not touch `.env`.
6. If the `.env` write fails after a successful `config.yaml` write, perform
   rollback according to pre-run state:
   - restore `config.yaml` from the fresh backup if the file existed before
     the run
   - delete the newly created `config.yaml` if it was first written by this
     run and had no pre-run backup
7. If best-effort restore/delete also fails, the helper must surface that
   failure as non-success and print explicit recovery instructions with backup
   paths.

The chosen ordering is a blast-radius decision: writing `config.yaml` first is
preferred over writing `OPENAI_API_KEY` first, because a premature shared-key
takeover can affect more Hermes surfaces than a temporarily updated main
`model.*` path.

### FR10. Verification Semantics

The utility must not promise deep runtime verification beyond what upstream
stably guarantees.

For v1, it is sufficient to provide:

- a successful pre-write `GET /v1/models` as a live auth + catalog signal for
  the key and model availability
- a clear post-write summary:
  - target config/env paths
  - the written `model.provider`
  - the written `model.base_url`
  - the written `model.default`

This PRD must not treat `/v1/models` as sufficient proof of full Hermes
runtime compatibility. Tool-calling readiness must be confirmed separately
through product qualification and launch testing.

This PRD also must not treat a successful `/v1/models` response as proof that
the first billable `POST /v1/chat/completions` will succeed without billing
issues. If the first real request later returns `429 insufficient_quota`, that
is a billing/account-state signal, not in itself proof of helper
misconfiguration.

## Error Handling

The utility must stop before writing under the following conditions:

- `hermes` is not found
- the hidden prompt is unavailable because there is no TTY
- the target install is in managed mode or upstream-blocked write mode
- `config.yaml` exists but does not parse as YAML
- the resolved `cron/jobs.json` exists, but the helper cannot reliably read it
  while evaluating the shared `OPENAI_API_KEY` blast radius
- the API key fails basic validation
- live `GET /v1/models` did not return a usable qualified result
- live `GET /v1/models` returned a terminal auth/access failure
- live `GET /v1/models` exhausted the bounded retry budget on a transient
  catalog or server failure
- an unresolved conflict is detected around the shared `OPENAI_API_KEY`
- an unresolved conflict is detected around `model.api_key` / `model.api` /
  incompatible `model.api_mode`
- an unresolved matching-entry conflict is detected in `custom_providers` /
  `providers:` for the canonical GonkaGate URL
- a matching custom credential-pool conflict is detected in the resolved
  `auth.json` for the canonical GonkaGate URL
- a conflicting non-canonical inherited process-env `OPENAI_BASE_URL` is
  detected, which the helper cannot clear itself
- a conflicting file-backed `OPENAI_BASE_URL` is detected and the user did not
  give explicit permission for cleanup
- the helper is run in an explicitly unsupported environment

The utility must not silently overwrite malformed config.

## Comparison to openclaw-setup

What is similar:

- one short public entrypoint
- a hidden secret prompt
- a qualified model picker
- safe config mutation
- backup and permission sensitivity

What is different:

- config-path resolution is simpler than in OpenClaw, but still requires an
  explicit position on profiles, managed installs, and public Hermes path
  seams
- first-run bootstrap must not require full `hermes setup`
- there is not as strong a verify surface as in OpenClaw
- the helper must be narrower and more careful in its promises

## Risks

1. `custom_providers` and the new `providers:` shape still coexist in Hermes,
   so the helper must not be built around named-provider internals.
2. Parts of Hermes still contain compatibility/warning paths around legacy
   `OPENAI_BASE_URL`, so careless cleanup or ignoring that value can surprise
   the user.
3. Shared `OPENAI_API_KEY` may be an implicit dependency for the main
   OpenRouter path, `smart_model_routing`, provider-based
   auxiliary/fallback/cron OpenRouter overrides, direct-endpoint
   auxiliary/delegation/fallback flows, cron jobs with direct `base_url`, and
   OpenAI audio/TTS/STT paths, so unconditional replacement can break an
   existing setup.
4. Existing `model.api_key` / `model.api` / `model.api_mode` can survive
   onboarding and create a false-success state if the helper does not take
   explicit ownership of those conflicts.
5. Matching entries under `custom_providers` / `providers:` can survive
   onboarding and remain a second active credential source for the same URL if
   the helper looks only at `model.*`.
6. Matching custom credential pools in `auth.json` can survive onboarding and
   quietly beat the helper-owned `OPENAI_API_KEY` if the launch contract does
   not pin an explicit abort boundary.
7. A shell-exported `OPENAI_BASE_URL` can survive cleanup of the resolved
   `.env` and leave a same-shell false-success state if the helper does not
   distinguish file-backed and inherited env conflicts.
8. In managed installs, Hermes may forbid local config writes.
9. The live GonkaGate catalog and the qualified allowlist may diverge and
   produce zero launchable models.
10. Upstream has no separate stable GonkaGate-specific verify contract, and
    GonkaGate documents tool calling as partial / model-dependent.
11. If the user has already deeply customized the `model` section, careless
    overwrite or bypassing public Hermes seams can break their setup.
12. If the helper bypasses profile-aware Hermes path resolution, it can target
    the wrong config.
13. If the PRD does not pin the platform boundary in advance, users can
    develop a false expectation of native Windows support.
14. If the product describes `npm`/`npx` as a universal runtime precondition,
    an already-installed `hermes-agent-setup` bin will be incorrectly treated
    as unsupported.
15. If the helper describes `/v1/models` as a "successful readiness check"
    without a billing/account-state caveat, support cases around
    `insufficient_quota` will look like installer regressions.
16. Read-side conflict classification depends on release-pinned Hermes
    normalization semantics; upstream drift between releases can silently break
    helper assumptions if the qualification artifact and release pin are not
    updated in time.
17. Hermes docs still describe `fallback_model.api_key_env`, but the verified
    fallback activation path does not use it directly; if the helper starts
    proving safety through doc-only fallback semantics, it can miss a real
    shared-key takeover surface.

## Assumptions

- [assumption] v1 targets only user-managed Hermes installs.
  Risk: managed installs may require a different integration path.
  Validation: explicitly fail fast and test the helper against Nix/Homebrew
  managed modes.

- [assumption] In Hermes, GonkaGate should be modeled specifically as
  `provider: custom`, not as a built-in Hermes provider.
  Risk: a richer first-class UX may be needed later.
  Validation: confirm that the qualified model flow and auth semantics do not
  require an upstream provider plugin.

- [assumption] Storing the secret in `.env` is better than in `config.yaml`,
  even if the upstream custom flow still allows `model.api_key`.
  Risk: upstream Hermes-owned flows may still rematerialize the secret in
  `model.api_key` or in a matching named custom-provider entry after the
  helper run.
  Validation: smoke-test runtime using only `OPENAI_API_KEY` in `.env`,
  `model.base_url` in config, and without stale `model.api_key` / `model.api`
  / incompatible `model.api_mode`; separately document that this is a
  helper-owned invariant at write time, not an indefinite global invariant.

- [assumption] For v1, relying on Hermes path seams and explicit `--profile`
  is sufficient, without inventing a separate helper-specific home-resolution
  model.
  Risk: edge cases may remain where power users expect a direct path override.
  Validation: pressure-test profiles, custom `HERMES_HOME`, and default root
  installs before the implementation freeze.

- [assumption] The launch allowlist must contain only models that passed
  Hermes-specific qualification for text turn + streaming, and tool calling
  should be validated separately only when the launch UX actually depends on
  it.
  Risk: without this, `/v1/models` can create a false sense of readiness.
  Validation: approve the launch matrix and run the minimum smoke suite.

## Resolved Launch Decisions

1. Package name and delivery path are finalized for v1:
   `@gonkagate/hermes-agent-setup`, primary public entrypoint
   `npx @gonkagate/hermes-agent-setup`, installed bin `hermes-agent-setup`.
   Compatible Node is the universal runtime precondition; `npm`/`npx` are
   explicit acquisition preconditions for the primary public `npx` path.

2. The initial launch-qualified allowlist is finalized outside this PRD in a
   versioned launch qualification artifact. v1 may still ship with a
   single-model launch, but the PRD does not freeze a live GonkaGate model ID.

3. The v1 public CLI supports explicit `--profile <name>`. Without that flag,
   the helper respects the current Hermes context and public Hermes path
   seams.

4. The v1 launch boundary is finalized as Linux, macOS, and WSL2 only. Native
   Windows and Android / Termux are explicitly unsupported at launch.

5. Existing shared `OPENAI_API_KEY` state is handled with a safe-abort-first
   policy. The helper may proceed only after explicit takeover confirmation
   when it can clearly enumerate the matched affected surface from the finite
   detection matrix in FR4. That matrix includes `smart_model_routing`,
   auxiliary/fallback/cron OpenRouter override surfaces, and treats ambiguous
   `cheap_model.provider == "custom"` without an explicit `base_url` as
   blocking in v1.

6. Matching entries under `custom_providers` / `providers:` that resolve to
   the canonical GonkaGate URL are not treated as harmless residue. If they
   contain competing auth/protocol selectors, the helper must either scrub only
   the fields allowed by FR6 after consolidated confirmation, or abort.

7. Matching custom credential pools in the resolved `auth.json` for the
   canonical GonkaGate URL are blocking conflicts in v1. The helper detects
   them and aborts with manual resolution guidance instead of mutating pool
   state.

8. v1 uses one consolidated pre-write review block and at most one
   confirmation prompt for the entire run. The helper does not open a
   multi-screen conflict wizard.

9. A file-backed `OPENAI_BASE_URL` equal to `https://api.gonkagate.com/v1` is
   resolved by planned cleanup to empty, because the canonical saved contract
   is `config.yaml`. Non-canonical file-backed values require explicit
   clear-or-abort UX. Inherited process-env `OPENAI_BASE_URL` is a
   manual-resolution blocker only when it is non-empty and non-canonical;
   inherited exact-match canonical values are warn-only because the helper
   cannot clear the parent shell env.

10. When `config.yaml` is missing, v1 writes only the minimal `model:` block
    defined in FR3 instead of materializing Hermes `DEFAULT_CONFIG`.

11. v1 write ordering is finalized as `config.yaml` first, `.env` second, with
    same-run backups and rollback by pre-run state on post-config `.env`
    failure: restore from backup when `config.yaml` pre-existed, otherwise
    delete the newly created file.

12. Launch qualification evidence is finalized as a checked-in repository
    artifact under
    `docs/launch-qualification/hermes-agent-setup/<hermes-release-tag>/<model-slug>.md`;
    release-checklist links may reference it, but do not replace it.

13. Any FR4 OpenRouter-routed surface (`main`, `smart_model_routing`,
    auxiliary override, `fallback_model.provider`, cron job `provider`) is
    treated as safely separated from shared `OPENAI_API_KEY` only when a
    usable `OPENROUTER_API_KEY` is visible in the resolved Hermes `.env` or
    inherited process environment at plan time.

14. Any non-empty `fallback_model.base_url` is treated as an affected
    shared-key surface in v1. The helper does not rely on non-release-pinned
    `api_key_env` semantics to prove separation.

15. Scrub-and-continue for matching entries under `custom_providers` /
    `providers:` is allowed only for one matching on-disk entry and only for
    the field set allowed by FR6. Multiple matching on-disk entries are
    blocking conflicts and cause abort.

16. For v1 public positioning, ordinary Hermes agent usage is treated as
    tool-using by default; therefore the harmless tool-use turn in FR5 remains
    part of launch qualification, not optional stretch evidence.

17. Public v1 positioning inherits the current GonkaGate Terms availability
    boundaries. The helper is not positioned for users or entities in the
    United States of America or U.S. territories.

18. Successful `GET /v1/models` is treated as an auth + live-catalog signal
    only. It is not treated as proof of prepaid-balance sufficiency or
    end-to-end readiness for a first billable `chat.completions` request.

19. v1 conflict classification is explicitly pinned to the Hermes normalized
    read semantics qualified for the target upstream release. Future Hermes
    releases require revalidation before the helper claims compatibility.

## Success Metrics

Primary:

- the user configures GonkaGate in Hermes in one short flow without manually
  editing files
- after completion, the user's `model.provider`, `model.base_url`, and
  `model.default` are set correctly
- the helper writes the GonkaGate secret only to the resolved Hermes `.env`
- the helper does not leave stale conflicting `model.api_key` / `model.api` /
  incompatible `model.api_mode`
- the helper does not leave an unresolved matching `custom_providers` /
  `providers:` auth/protocol source for the same canonical GonkaGate URL
- the helper does not claim success while a matching custom credential pool in
  `auth.json` remains active for the same canonical GonkaGate URL
- the selected model is present both in the qualified allowlist and in live
  `/v1/models`
- the helper does not write the GonkaGate secret to `config.yaml`

Secondary:

- the number of support cases caused by manual Hermes config editing decreases
- repeat setup on a new machine becomes deterministic

## Launch Readiness

For v1, it is sufficient to have:

- a working happy path on a clean `HERMES_HOME`, including the case where
  `config.yaml` does not already exist
- path resolution through the default profile, sticky active profile, explicit
  `--profile`, and custom `HERMES_HOME`
- the exact minimal bootstrap config contract when `config.yaml` is missing
- safe overwrite behavior on existing config
- one consolidated pre-write review block with at most one confirmation prompt
- a helper-owned atomic multi-field config write
- per-file atomic writes with rollback-safe ordering across `.env` and
  `config.yaml`
- backup creation with the finalized sibling naming contract
- parse-failure behavior
- live `/models` qualified-allowlist filtering behavior
- retry/error-classification behavior for `/v1/models` (`401`, terminal
  auth/access failures, transient `5xx/503`, malformed response)
- launch qualification evidence for every model in the qualified allowlist
- shared `OPENAI_API_KEY` takeover UX
- the finite detection matrix for shared `OPENAI_API_KEY` blast radius
- `smart_model_routing` shared-key detection and blocking behavior
- auxiliary/fallback/cron OpenRouter override detection behavior
- `cron/jobs.json` direct-endpoint detection behavior
- stale `model.api_key` / `model.api` / `model.api_mode` resolution UX
- matching `custom_providers` / `providers:` conflict-resolution UX
- matching `auth.json` custom credential-pool conflict UX
- conflicting file-backed vs inherited-process-env `OPENAI_BASE_URL`
  resolution UX
- exact-match `OPENAI_BASE_URL == https://api.gonkagate.com/v1` cleanup policy
- Hermes-compatible normalized config-read semantics for conflict detection,
  including `${VAR}` expansion and legacy root-level `provider` / `base_url`
  migration
- rollback semantics when `config.yaml` is first created during the same run
- explicit unsupported behavior for managed installs
- explicit unsupported behavior for native Windows
- clear target-home semantics for profile users

## Implementation Validation

The items below remain mandatory validation work before implementation freeze,
but they are no longer open product-definition questions for v1.

Seams to pressure-test before implementation:

1. The ownership boundary between public Hermes read seams, `.env` writes, and
   helper-owned config writes.
2. Helper behavior when a non-standard `model` section already exists.
3. Helper behavior for shared `OPENAI_API_KEY` conflicts,
   `smart_model_routing`, and existing direct endpoint overrides.
4. Helper behavior for live `/models` success, zero qualified intersection,
   terminal auth/access failures, and transient network failures.
5. Explicit target-home semantics for profiles and custom `HERMES_HOME`.
6. The minimum Hermes smoke suite for launch-qualified GonkaGate models.

## Readiness Decision

pass with closed v1 product decisions and mandatory implementation validation

The problem, launch contract, and key risks are clear enough to move to a
detailed implementation spec. For v1, this PRD no longer contains unresolved
product-definition questions; what remains is implementation, qualification,
and launch-evidence work.
