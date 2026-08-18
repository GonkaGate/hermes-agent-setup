# @gonkagate/hermes-agent-setup

Set up `hermes-agent` to use GonkaGate in one `npx` command.

```bash
npx @gonkagate/hermes-agent-setup
```

![Package](https://img.shields.io/badge/package-%40gonkagate%2Fhermes--agent--setup-6E63FF?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D22.14.0-4DA2FF?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-2A2A2A?style=flat-square)

[![Website](https://img.shields.io/badge/Website-gonkagate.com-111827?style=flat-square)](https://gonkagate.com/en?utm_source=github&utm_medium=referral&utm_campaign=hermes_agent_setup&utm_content=readme_badge_website)
[![Docs](https://img.shields.io/badge/Docs-API%20Guides-2563EB?style=flat-square)](https://gonkagate.com/en/docs?utm_source=github&utm_medium=referral&utm_campaign=hermes_agent_setup&utm_content=readme_badge_docs)
[![API%20Key](https://img.shields.io/badge/API%20Key-Dashboard-F97316?style=flat-square)](https://gonkagate.com/en/register?utm_source=github&utm_medium=referral&utm_campaign=hermes_agent_setup&utm_content=readme_badge_api_key)
[![Telegram](https://img.shields.io/badge/Telegram-%40gonkagate-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/gonkagate)
[![X](https://img.shields.io/badge/X-%40gonkagate-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/gonkagate)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-GonkaGate-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/gonkagate)

## Overview

`@gonkagate/hermes-agent-setup` is a small onboarding helper for people who
use `hermes-agent` and want it configured to use GonkaGate without manually
editing `~/.hermes/config.yaml` or `~/.hermes/.env`.

The public entrypoint is `npx @gonkagate/hermes-agent-setup`. The installed
primary bin is `hermes-agent-setup`.

## Is This For You?

This helper is for you if you want Hermes to use GonkaGate as its primary
OpenAI-compatible endpoint through the named custom provider
`gonkagate` and `https://api.gonkagate.com/v1`.

You should also have:

- `hermes-agent` available on your machine
- Hermes Agent `v2026.5.16` / `v0.14.0` or newer
- a GonkaGate API key
- an interactive terminal
- Linux, macOS, or WSL2

Public onboarding is not positioned for users or entities in the United States
of America or U.S. territories.

## What Happens During Setup

In plain language, the helper:

- finds the active Hermes config, including `--profile <name>` if you use one
- asks for your GonkaGate key through a hidden prompt
- calls `GET /v1/models` and offers the live models returned by GonkaGate, in
  catalog order, preselecting the first one
- labels each choice with whatever name, description, and context length the
  live catalog provides, and falls back to the model ID when it provides none
- writes the minimum Hermes settings needed for GonkaGate
- rolls back if a later write fails

This is an onboarding helper, not a full Hermes installer or deep verifier. A
successful `GET /v1/models` check confirms auth and model visibility only. It
does not prove billing, quota, or first-request readiness.

## What It Changes

The helper manages these Hermes files:

- `~/.hermes/config.yaml`
- `~/.hermes/.env`

It configures Hermes to use:

- `model.provider = gonkagate`
- `providers.gonkagate`
- `https://api.gonkagate.com/v1`

Your raw GonkaGate key is stored only in `~/.hermes/.env`. It is never written
to `config.yaml`; the config only stores `key_env: GONKAGATE_API_KEY` on the
managed custom provider.

When setup succeeds, the helper writes only the GonkaGate-managed surface:

- `providers.gonkagate.base_url`
- `providers.gonkagate.key_env`
- `providers.gonkagate.transport`
- `providers.gonkagate.discover_models`
- `providers.gonkagate.models`
- `model.provider`
- `model.default`
- `GONKAGATE_API_KEY`

## Important Limits

The shipped helper intentionally stays narrow:

- it does not replace `hermes setup`
- it does not support legacy endpoint paths such as `OPENAI_BASE_URL`,
  `LLM_MODEL`, or root-level `provider` / `base_url`
- it does not accept arbitrary custom base URLs
- it does not manage arbitrary custom providers beyond the `gonkagate` entry
- it does not mutate shell profiles
- it does not mutate `auth.json` credential pools
- it does not support native Windows
- it does not claim full first-request verification beyond `GET /v1/models`

`GET /v1/models` is the runtime source of truth for selectable models, their
metadata, and which one is preselected. The checked-in launch qualification
artifacts are maintainer evidence only; they are not a runtime allowlist, they
do not name a default model, and they do not need repository updates for a live
model to appear in setup.

After setup, Hermes can switch between the configured GonkaGate models with
commands such as:

```text
/model gonkagate:<model-id> --global
```

If you need general Hermes setup help or deeper product context first, start at
[gonkagate.com](https://gonkagate.com/?utm_source=github&utm_medium=referral&utm_campaign=hermes_agent_setup&utm_content=readme_website_link).

## Learn More

- [How It Works](./docs/how-it-works.md)
- [Security](./docs/security.md)
- [Product Spec](./docs/specs/hermes-agent-setup-prd/spec.md)
- [Latest Hermes Contract Adaptation](./docs/specs/hermes-latest-contract-adaptation/spec.md)
