---
modelId: alpha/model-a
qualifiedOn: 2026-04-15
hermesReleaseTag: v2026.4.13
hermesCommit: abcdef1234567890
osCoverage:
  - linux
  - macos
  - wsl2
recommended: false
---

## Sanitized Config Shape

```yaml
model:
  provider: custom
  base_url: https://api.gonkagate.com/v1
  default: alpha/model-a
```

## Sanitized Env Shape

```dotenv
OPENAI_API_KEY=[REDACTED]
```

## Basic Text Turn

Recorded in qualification fixture.

## Streaming Turn

Recorded in qualification fixture.

## Harmless Tool-Use Turn

Recorded in qualification fixture.
