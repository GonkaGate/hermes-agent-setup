---
modelId: alpha/model-a
qualifiedOn: 2026-04-15
hermesReleaseTag: v2026.5.16
hermesCommit: abcdef1234567890
osCoverage:
  - linux
  - macos
  - wsl2
recommended: false
---

## Sanitized Config Shape

```yaml
custom_providers:
  - name: gonkagate
    base_url: https://api.gonkagate.com/v1
    key_env: GONKAGATE_API_KEY
    api_mode: chat_completions
    models:
      alpha/model-a: {}
model:
  provider: custom:gonkagate
  default: alpha/model-a
```

## Sanitized Env Shape

```dotenv
GONKAGATE_API_KEY=[REDACTED]
```

## Basic Text Turn

Recorded in qualification fixture.

## Streaming Turn

Recorded in qualification fixture.

## Harmless Tool-Use Turn

Recorded in qualification fixture.
