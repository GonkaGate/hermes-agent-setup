# Security

This document captures the shipped security posture for
`@gonkagate/hermes-agent-setup`.

## Secret Handling

The public helper accepts the GonkaGate key only through a hidden interactive
prompt. It does not accept a plain `--api-key` flag.

The canonical secret contract is:

- store the key only in the resolved Hermes `.env` file
- never write the raw key to `config.yaml`
- write only the non-secret `key_env: GONKAGATE_API_KEY` selector on the
  managed `custom_providers[name=gonkagate]` entry
- never print the raw key to stdout or stderr
- redact raw `gp-...` values and `Bearer` tokens in unexpected error paths

## File Ownership And Writes

The helper writes only the minimum GonkaGate-managed surface:

- `custom_providers[name=gonkagate].base_url`
- `custom_providers[name=gonkagate].key_env`
- `custom_providers[name=gonkagate].api_mode`
- `custom_providers[name=gonkagate].models`
- `model.provider`
- `model.default`
- `GONKAGATE_API_KEY`

Cleanup is limited to the old helper-managed direct custom model fields
(`model.base_url`, `model.api_key`) plus current model-owned conflict surfaces:
`model.api` and incompatible `model.api_mode`.

Write safety rules:

- resolve the full review plan before any write
- create same-run backups before replacing existing files
- write `config.yaml` first and `.env` second
- roll back `config.yaml` if a later `.env` write fails
- use owner-only `.env` permissions where supported on launch platforms

## Conflict Surfaces

The shipped runtime treats these as active security or correctness surfaces:

- shared `OPENAI_API_KEY` consumers
- current `providers:` entries that point at the canonical GonkaGate URL
- duplicate matching `custom_providers` entries or matching entries not named
  `gonkagate`
- matching `auth.json` credential pools under `credential_pool["custom:*"]`

The helper manages only `custom_providers[name=gonkagate]`. It does not mutate
arbitrary provider registries or `auth.json` credential pools in v1. These
remain blocking manual-resolution cases with Hermes-owned follow-up.

## Qualification And Verification Limits

The helper uses `GET /v1/models` as the live auth and catalog check before any
write, then intersects that result with checked-in launch qualification
artifacts.

That signal is intentionally limited:

- it confirms auth and model visibility
- it does not confirm billing or quota sufficiency
- it does not prove end-to-end Hermes runtime readiness for the first billable
  request

Launch qualification evidence lives under
`docs/launch-qualification/hermes-agent-setup/`.

## Security Non-Goals

The helper does not take ownership of:

- shell profile mutation
- arbitrary custom provider management
- arbitrary custom base URLs
- legacy endpoint paths such as `OPENAI_BASE_URL`, `LLM_MODEL`, root-level
  `provider` / `base_url`
- repository-local `.env` files
- direct mutation of `auth.json`
