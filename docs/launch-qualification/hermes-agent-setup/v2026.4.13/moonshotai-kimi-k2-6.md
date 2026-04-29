---
modelId: moonshotai/Kimi-K2.6
qualifiedOn: 2026-04-29
hermesReleaseTag: v2026.4.13
hermesCommit: launch-qualification-recorded-internal
osCoverage:
  - linux
  - macos
  - wsl2
recommended: true
---

# `moonshotai/Kimi-K2.6`

This record defines the checked-in allowlist entry consumed by the shipped
runtime for the pinned Hermes release.

## Sanitized Config Shape

```yaml
model:
  provider: custom
  base_url: https://api.gonkagate.com/v1
  default: moonshotai/Kimi-K2.6
```

## Sanitized Env Shape

```dotenv
OPENAI_API_KEY=[REDACTED]
```

## Basic Text Turn

Saved basic-text qualification evidence is tracked in the GonkaGate release
qualification workflow and summarized by this checked-in allowlist record.

## Streaming Turn

Saved streaming qualification evidence is tracked in the same release
qualification workflow for the pinned Hermes release.

## Harmless Tool-Use Turn

Saved harmless tool-use qualification evidence is tracked in the same release
qualification workflow for the pinned Hermes release.
