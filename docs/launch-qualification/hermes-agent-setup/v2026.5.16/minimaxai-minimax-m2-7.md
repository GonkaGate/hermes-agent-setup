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

This record defines the checked-in allowlist entry consumed by the shipped
runtime for the latest-only Hermes release contract.

## Sanitized Config Shape

```yaml
custom_providers:
  - name: gonkagate
    base_url: https://api.gonkagate.com/v1
    key_env: GONKAGATE_API_KEY
    api_mode: chat_completions
    models:
      minimaxai/minimax-m2.7: {}
model:
  provider: custom:gonkagate
  default: minimaxai/minimax-m2.7
```

## Sanitized Env Shape

```dotenv
GONKAGATE_API_KEY=[REDACTED]
```

## Basic Text Turn

Saved basic-text qualification evidence is tracked in the GonkaGate release
qualification workflow and summarized by this checked-in allowlist record.

## Streaming Turn

Saved streaming qualification evidence is tracked in the same release
qualification workflow for the latest-only Hermes release.

## Harmless Tool-Use Turn

Saved harmless tool-use qualification evidence is tracked in the same release
qualification workflow for the latest-only Hermes release.
