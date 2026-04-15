# Repo Context Routing

Use this file to choose only the repository context that materially changes the
generated context handoff prompt.

Do not dump the whole repo summary into the output. Pull only the relevant
points.

## Always-True Defaults

- The downstream agent already works inside this repository.
- Do not explain how to inspect files, edit code, create folders, or run
  ordinary repo commands.
- `hermes-agent-setup` is a TypeScript/Node repository for the shipped
  GonkaGate onboarding helper for `hermes-agent`.
- Canonical surfaces today are `src/cli.ts`, `src/constants/contract.ts`,
  `README.md`, `AGENTS.md`, `docs/`, `test/cli.test.ts`,
  `test/package-contract.test.ts`, `test/docs-contract.test.ts`,
  `test/skills-contract.test.ts`, `scripts/run-tests.mjs`,
  `.github/workflows/`, `package.json`, `release-please-config.json`, and
  `.agents/skills/`.
- `README.md`, `AGENTS.md`, and the files under `docs/` are the main current
  contract surfaces for product and security behavior.
- Avoid generic tool instructions like "inspect the repo" unless the request
  explicitly needs them.

## Use Repo Constraints Selectively

Include a repository constraint only when it changes the task:

- the target public UX is `npx @gonkagate/hermes-agent-setup`
- the installed primary bin is `hermes-agent-setup`
- the current CLI is a shipped onboarding entrypoint backed by runtime modules
  and checked-in qualification artifacts
- the intended Hermes config targets are `~/.hermes/config.yaml` and
  `~/.hermes/.env`
- the intended integration path is `provider: custom`
- the canonical GonkaGate base URL is `https://api.gonkagate.com/v1`
- secrets belong in `~/.hermes/.env`, not in `config.yaml`
- curated model selection is product-owned and artifact-backed at runtime
- shell profile mutation is out of scope
- arbitrary custom base URLs are out of scope for the public flow
- deep runtime verification is out of scope for v1 unless upstream exposes a
  stronger stable contract
- if public behavior changes, `README.md`, `AGENTS.md`, `docs/`, and
  `CHANGELOG.md` may need updates to stay truthful

## Routing By Task Signal

### CLI, Package, Release, Public UX

Use when the request mentions CLI flags, help output, package entrypoints,
release automation, publish flow, commit naming, or user-facing onboarding.

Useful context:

- `src/cli.ts`
- `src/constants/contract.ts`
- `bin/gonkagate-hermes-agent-setup.js`
- `package.json`
- `release-please-config.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`
- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`

### Provider Architecture, Config Scope, Auth, Security

Use when the request mentions `~/.hermes/config.yaml`, `~/.hermes/.env`,
`provider: custom`, `https://api.gonkagate.com/v1`, `HERMES_HOME`,
`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GET /v1/models`, `gp-...`,
`auth.json`, `cron/jobs.json`, or Hermes config semantics.

Useful context:

- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/specs/hermes-agent-setup-prd/spec.md`
- `src/constants/contract.ts`
- `test/docs-contract.test.ts`

Relevant reminders:

- the runtime exists under `src/`, and docs plus implementation modules both
  matter for these topics
- prompts should point toward the shipped runtime surfaces and product contract
  first, then propose deeper changes only when the user is clearly asking for
  them

### Docs, Product Messaging, Truthfulness

Use when the task is mainly about repository documentation, public flow
description, security wording, changelog accuracy, PRD alignment, or keeping
shipped-helper claims honest.

Useful context:

- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/specs/hermes-agent-setup-prd/spec.md`
- `CHANGELOG.md`
- `src/cli.ts`
- `src/constants/contract.ts`

Relevant reminders:

- docs should distinguish shipped behavior from PRD non-goals or future product
  changes
- product-surface changes are not just copy edits; they may imply architecture
  or implementation work

### Tests, Tooling, Contract Integrity

Use when the request mentions test coverage, repository contract checks, CI,
formatting, package quality, or release automation safety.

Useful context:

- `test/cli.test.ts`
- `test/package-contract.test.ts`
- `test/docs-contract.test.ts`
- `test/skills-contract.test.ts`
- `scripts/run-tests.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-please.yml`

Relevant reminders:

- repository tests protect shipped-runtime and doc-contract expectations
- `npm run ci` is the primary local verification command

### Skills, Prompts, Agent Workflow

Use when the request is about local skills, prompt rewriting, agent
instructions, or repo-local workflow assets.

Useful context:

- `.agents/skills/`
- the specific local skill folder touched by the request
- `AGENTS.md` when the task touches contributor workflow rules
- `test/skills-contract.test.ts` when the repo should enforce the new
  expectation

Relevant reminders:

- contributor skills are mirrored in this repo under `.agents/skills/`
- do not assume a `.claude` mirror exists unless you verify one
- prompt assets should stay aligned with the actual shipped-runtime repo state
- if a skill is repo-specific, examples and literals should point to Hermes and
  current repo surfaces rather than stale paths from another repository

## Output Discipline

When you include repo context in the final handoff prompt:

- prefer short bullets or short paragraphs
- name the most relevant docs or code areas first
- keep background only if it changes the downstream agent's first decisions
- avoid repeating repo facts unless they change the downstream agent's first
  decisions
