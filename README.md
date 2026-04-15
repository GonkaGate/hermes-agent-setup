# @gonkagate/hermes-agent-setup

`@gonkagate/hermes-agent-setup` is the onboarding CLI for people who already
use `hermes-agent` and want GonkaGate configured as their primary
OpenAI-compatible endpoint without hand-editing `~/.hermes/config.yaml` or
`~/.hermes/.env`.

If you only remember one command, make it this:

```bash
npx @gonkagate/hermes-agent-setup
```

The shipped helper resolves the active Hermes context, classifies competing
runtime state, prompts for a hidden GonkaGate `gp-...` key, intersects the
live `GET /v1/models` catalog with checked-in launch qualification artifacts,
writes the minimum safe Hermes config surface, stores the secret only in
`~/.hermes/.env`, and rolls back if a later write fails.

## What The Helper Does

- resolves `config.yaml` and `.env` through Hermes-owned path seams, including
  explicit `--profile <name>`
- checks Node, TTY, platform, Hermes availability, and managed-install guards
  before any prompt or write
- reads `config.yaml`, `.env`, `auth.json`, and `cron/jobs.json` into a
  release-pinned normalized Hermes view for conflict classification
- detects shared `OPENAI_API_KEY`, `OPENAI_BASE_URL`, matching provider-entry,
  and matching auth-pool conflicts before writing anything
- prompts for the key only through a hidden interactive prompt
- writes only `model.provider`, `model.base_url`, `model.default`, and
  `OPENAI_API_KEY`, plus conflict-only cleanup allowed by the PRD
- writes `config.yaml` before `.env`, creates same-run backups, and rolls back
  if the later `.env` write fails

## Current Product Truth

The current shipped runtime is intentionally narrow:

- public entrypoint: `npx @gonkagate/hermes-agent-setup`
- installed primary bin: `hermes-agent-setup`
- canonical base URL: `https://api.gonkagate.com/v1`
- integration path: `provider: custom`
- launch platforms: Linux, macOS, and WSL2
- unsupported at launch: native Windows, Android, and Termux
- current checked-in allowlist: `qwen/qwen3-235b-a22b-instruct-2507-fp8`

The helper does not:

- replace `hermes setup`
- mutate shell profiles
- accept arbitrary custom base URLs
- mutate `auth.json` credential pools
- claim that a successful `GET /v1/models` proves billing or first-request
  readiness

Public onboarding also inherits current GonkaGate availability boundaries and
is not positioned for users or entities in the United States of America or
U.S. territories.

## Safe Inputs And Files

Safe secret behavior:

- the public flow accepts the GonkaGate key only through a hidden prompt
- the key is saved only in the resolved Hermes `.env` file
- the key is never written to `config.yaml`
- CLI diagnostics redact raw `gp-...` keys and `Bearer` tokens

The important managed locations are:

- `~/.hermes/config.yaml`
- `~/.hermes/.env`
- `docs/launch-qualification/hermes-agent-setup/`

## Launch Qualification

Runtime model selection is driven by checked-in launch qualification artifacts
under:

`docs/launch-qualification/hermes-agent-setup/<hermes-release-tag>/<model-slug>.md`

The shipped helper only offers models that are both:

1. present in the checked-in allowlist for the pinned Hermes release
2. still visible in the live GonkaGate `/v1/models` catalog

Use the maintainer scripts under
[`scripts/launch-qualification/`](./scripts/launch-qualification/) to prepare
clean-home runs, build artifacts, and validate the checked-in artifact tree.

## Docs

The most important repository contract docs are:

- [PRD](./docs/specs/hermes-agent-setup-prd/spec.md)
- [How It Works](./docs/how-it-works.md)
- [Security](./docs/security.md)
- [Launch Qualification](./docs/launch-qualification/hermes-agent-setup/README.md)
- [Release Readiness](./docs/release-readiness/hermes-agent-setup-v1.md)

## Development

```bash
npm install
npm run dev
```

Useful commands:

- `npm run typecheck`
- `npm test`
- `npm run qualification:artifact:validate`
- `npm run ci`
