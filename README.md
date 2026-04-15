# @gonkagate/hermes-agent-setup

`@gonkagate/hermes-agent-setup` is a small onboarding helper for people who use
`hermes-agent` and want it configured to use
[GonkaGate](https://gonkagate.com) without manually editing
`~/.hermes/config.yaml` or `~/.hermes/.env`.

If that is what you need, run this:

```bash
npx @gonkagate/hermes-agent-setup
```

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
