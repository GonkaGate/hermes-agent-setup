---
modelId: qwen/qwen3-235b-a22b-instruct-2507-fp8
qualifiedOn: 2026-04-15
hermesReleaseTag: v2026.5.16
hermesCommit: abcdef1234567890
osCoverage:
  - linux
  - macos
  - wsl2
---

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

Recorded in qualification fixture.

## Streaming Turn

Recorded in qualification fixture.

## Harmless Tool-Use Turn

Recorded in qualification fixture.
