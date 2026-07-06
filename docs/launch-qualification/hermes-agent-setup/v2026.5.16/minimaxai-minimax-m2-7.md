---
modelId: minimaxai/minimax-m2.7
qualifiedOn: 2026-05-29
hermesReleaseTag: v2026.5.16
hermesCommit: launch-qualification-recorded-internal
osCoverage:
  - linux
  - macos
  - wsl2
recommended: false
---

# `minimaxai/minimax-m2.7`

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
      minimaxai/minimax-m2.7: {}
model:
  provider: gonkagate
  default: minimaxai/minimax-m2.7
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
