# Security

This document captures the shipped security posture for
`@gonkagate/hermes-agent-setup`.

## Secret Handling

The public helper accepts the GonkaGate key only through a hidden interactive
prompt. It does not accept a plain `--api-key` flag.

The canonical secret contract is:

- store the key only in the resolved Hermes `.env` file
- never write the key to `config.yaml`
- never print the raw key to stdout or stderr
- redact raw `gp-...` values and `Bearer` tokens in unexpected error paths

## File Ownership And Writes

The helper writes only the minimum GonkaGate-managed surface:

- `model.provider`
- `model.base_url`
- `model.default`
- `OPENAI_API_KEY`

Conflict-only cleanup is limited to the PRD-approved surfaces such as
`model.api_key`, `model.api`, incompatible `model.api_mode`, and one matching
provider entry when that scrub stays inside the allowed field set.

Write safety rules:

- resolve the full review plan before any write
- create same-run backups before replacing existing files
- write `config.yaml` first and `.env` second
- roll back `config.yaml` if a later `.env` write fails
- use owner-only `.env` permissions where supported on launch platforms

## Conflict Surfaces

The shipped runtime treats these as active security or correctness surfaces:

- shared `OPENAI_API_KEY` consumers
- file-backed and inherited-process `OPENAI_BASE_URL`
- matching `custom_providers` / `providers:` entries that point at the
  canonical GonkaGate URL
- matching `auth.json` credential pools under `credential_pool["custom:*"]`

The helper may scrub one matching provider entry after consolidated review, but
it does not mutate `auth.json` credential pools in v1. Matching credential
pools remain a blocking manual-resolution case with Hermes-owned follow-up.

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
- repository-local `.env` files
- direct mutation of `auth.json`
