# AGENTS.md

## What This Repository Is

`hermes-agent-setup` is the onboarding repository for the shipped GonkaGate
CLI that configures local `hermes-agent` to use GonkaGate as the primary
OpenAI-compatible endpoint without asking users to hand-edit
`~/.hermes/config.yaml` and `~/.hermes/.env`.

Current honest state:

- the end-to-end public onboarding runtime is implemented
- the PRD is present under `docs/specs/hermes-agent-setup-prd/spec.md`
- CI, packaging, docs, contract tests, and mirrored skills are wired
- the helper targets latest-only Hermes Agent `v2026.5.16` / `v0.14.0` or
  newer, and fails older Hermes versions during preflight
- the current CLI resolves the active Hermes context, classifies conflicts,
  prompts for a hidden GonkaGate key, fetches the live catalog, intersects it
  with checked-in launch qualification artifacts, writes the managed
  `providers.gonkagate` / `model.provider = gonkagate`
  Hermes surface, and rolls back if a later write fails
- checked-in launch qualification artifacts exist under
  `docs/launch-qualification/hermes-agent-setup/`

If the implementation status, package name, config targets, or product scope
changes, this file must be updated immediately so it stays truthful.

## Product Direction

The shipped product is a narrow onboarding helper, not a full
`openclaw-setup`-style installer/verifier.

Product invariants:

- Hermes remains the upstream-owned bootstrap flow
- the primary public entrypoint is `npx @gonkagate/hermes-agent-setup`
- the installed primary bin is `hermes-agent-setup`
- the integration path is the named custom provider `gonkagate`
- the canonical GonkaGate base URL is `https://api.gonkagate.com/v1`
- secrets belong in `~/.hermes/.env`, not in `config.yaml`
- curated model selection is product-owned
- latest-only Hermes Agent `v2026.5.16` / `v0.14.0` or newer is the supported
  runtime floor
- shell profile mutation is out of scope
- legacy endpoint paths such as `OPENAI_BASE_URL`, `LLM_MODEL`, and root-level
  `provider` / `base_url` are out of scope for the public flow
- arbitrary custom-provider management is out of scope; the helper owns only
  the `custom_providers` entry named `gonkagate`
- arbitrary custom base URLs are out of scope for the public flow
- v1 launch scope is Linux, macOS, and WSL2 only
- public onboarding inherits current GonkaGate Terms availability boundaries;
  the public flow is not positioned for users or entities in the United States
  of America or U.S. territories
- deep runtime verification is out of scope for v1 unless upstream provides a
  stronger stable contract

## Current Repository Truth

Today this repository contains:

- npm/package metadata
- the shipped TypeScript CLI runtime
- launch qualification artifacts and qualification scripts
- honest public docs and release-readiness notes
- mirrored contributor skills under `.agents/skills` and `.claude/skills`
- CI, publish, and release-please automation
- fixture-driven tests for CLI, qualification, preconditions, path resolution,
  conflict classification, write planning, rollback, and release contracts

Today this repository does not contain:

- arbitrary custom base URL support
- shell profile mutation
- direct `auth.json` credential-pool mutation
- native Windows launch support
- billing or first-request readiness proof beyond the bounded `/v1/models` and
  launch qualification contract

## Repository Structure

```text
.
├── .agents/
│   └── skills/
├── .claude/
│   └── skills/
├── AGENTS.md
├── RTK.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.build.json
├── .github/workflows/
├── bin/
│   └── gonkagate-hermes-agent-setup.js
├── docs/
│   ├── README.md
│   ├── how-it-works.md
│   ├── launch-qualification/
│   ├── release-readiness/
│   ├── security.md
│   └── specs/
│       └── hermes-agent-setup-prd/
│           └── spec.md
├── scripts/
│   ├── launch-qualification/
│   └── run-tests.mjs
├── src/
│   ├── cli.ts
│   ├── cli/
│   ├── commands/
│   ├── constants/
│   ├── domain/
│   ├── hermes/
│   └── runtime/
└── test/
    ├── cli.test.ts
    ├── docs-contract.test.ts
    ├── fixtures/
    ├── helpers/
    ├── package-contract.test.ts
    ├── path-resolution.test.ts
    ├── preconditions.test.ts
    ├── qualification/
    └── skills-contract.test.ts
```

## Development Commands

Install dependencies:

```bash
npm install
```

Useful commands:

```bash
npm run dev
npm run typecheck
npm test
npm run ci
```

@RTK.md

## Release Please Commit Naming

This repository uses `release-please`, so commit messages that land on `main`
must follow Conventional Commits if you want automatic versioning and
changelog generation to work correctly.

- Use `feat: ...` for user-visible features; this triggers a minor release.
- Use `fix: ...` for bug fixes; this triggers a patch release.
- Use `feat!: ...` or `fix!: ...`, or add a `BREAKING CHANGE:` footer, for
  breaking changes; this triggers a major release.
- Use `docs: ...`, `test: ...`, `chore: ...`, or `refactor: ...` only when no
  version bump is intended by itself.
- If changes are merged with squash merge, the final squash commit title must
  also follow this format, because `release-please` reads the commit that
  actually lands on `main`.

Examples:

```text
feat: add hermes config discovery scaffold
fix: handle missing ~/.hermes/.env gracefully
feat!: change public bin name
```

## How To Make Changes Safely

- Keep the README and AGENTS truthful about the current implementation status.
- Keep mirrored contributor skills in `.agents/skills` and `.claude/skills`
  aligned with each other and with the neighboring `opencode-setup` repo
  unless an intentional divergence is documented.
- Use Conventional Commit titles for commits that will land on `main` so
  `release-please` can determine the correct version bump and changelog entry.
- Treat package name, public command, and config-target assumptions as product
  decisions, not casual refactors.
- When implementation starts, add tests alongside any new config or security
  behavior.
