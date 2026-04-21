# @gonkagate/hermes-agent-setup

Set up `hermes-agent` to use GonkaGate in one `npx` command.

```bash
npx @gonkagate/hermes-agent-setup
```

![Package](https://img.shields.io/badge/package-%40gonkagate%2Fhermes--agent--setup-6E63FF?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D22.14.0-4DA2FF?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-2A2A2A?style=flat-square)

[![Website](https://img.shields.io/badge/Website-gonkagate.com-111827?style=flat-square)](https://gonkagate.com/en)
[![Docs](https://img.shields.io/badge/Docs-API%20Guides-2563EB?style=flat-square)](https://gonkagate.com/en/docs)
[![API%20Key](https://img.shields.io/badge/API%20Key-Dashboard-F97316?style=flat-square)](https://gonkagate.com/en/register)
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
OpenAI-compatible endpoint through `provider: custom` and
`https://api.gonkagate.com/v1`.

You should also have:

- `hermes-agent` available on your machine
- a GonkaGate API key
- an interactive terminal
- Linux, macOS, or WSL2

Public onboarding is not positioned for users or entities in the United States
of America or U.S. territories.

## What Happens During Setup

In plain language, the helper:

- finds the active Hermes config, including `--profile <name>` if you use one
- asks for your GonkaGate key through a hidden prompt
- calls `GET /v1/models`, compares the live catalog with checked-in launch
  qualification artifacts, and offers only currently qualified models
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

- `provider: custom`
- `https://api.gonkagate.com/v1`

Your GonkaGate key is stored only in `~/.hermes/.env`. It is never written to
`config.yaml`.

When setup succeeds, the helper writes only the GonkaGate-managed surface:

- `model.provider`
- `model.base_url`
- `model.default`
- `OPENAI_API_KEY`

## Important Limits

The shipped helper intentionally stays narrow:

- it does not replace `hermes setup`
- it does not accept arbitrary custom base URLs
- it does not mutate shell profiles
- it does not mutate `auth.json` credential pools
- it does not support native Windows
- it does not claim full first-request verification beyond `GET /v1/models`

The current checked-in launch qualification artifacts include:

- `qwen/qwen3-235b-a22b-instruct-2507-fp8`

If you need general Hermes setup help or deeper product context first, start at
[gonkagate.com](https://gonkagate.com).

## Learn More

- [How It Works](./docs/how-it-works.md)
- [Security](./docs/security.md)
- [Product Spec](./docs/specs/hermes-agent-setup-prd/spec.md)
