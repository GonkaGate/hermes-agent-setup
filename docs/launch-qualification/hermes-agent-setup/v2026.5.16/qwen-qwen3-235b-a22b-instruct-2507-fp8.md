---
modelId: qwen/qwen3-235b-a22b-instruct-2507-fp8
qualifiedOn: 2026-05-24
hermesReleaseTag: v2026.5.16
hermesCommit: a91a57fa5a13d516c38b07a141a9ce8a3daabeb0
osCoverage:
  - linux
  - macos
  - wsl2
---

# `qwen/qwen3-235b-a22b-instruct-2507-fp8`

This record captures checked-in qualification evidence for the latest-only
Hermes release contract. It is not consumed as a runtime allowlist entry.

## Sanitized Config Shape

```yaml
providers:
  gonkagate:
    name: gonkagate
    base_url: https://api.gonkagate.com/v1
    key_env: GONKAGATE_API_KEY
    transport: chat_completions
    discover_models: false
    models:
      qwen/qwen3-235b-a22b-instruct-2507-fp8: {}
model:
  provider: gonkagate
  default: qwen/qwen3-235b-a22b-instruct-2507-fp8
```

## Sanitized Env Shape

```dotenv
GONKAGATE_API_KEY=[REDACTED]
```

## Basic Text Turn

Saved basic-text qualification evidence is tracked in the GonkaGate release
qualification workflow and summarized by this checked-in evidence record.

## Streaming Turn

Saved streaming qualification evidence is tracked in the same release
qualification workflow for the latest-only Hermes release.

## Harmless Tool-Use Turn

Saved harmless tool-use qualification evidence is tracked in the same release
qualification workflow for the latest-only Hermes release.
