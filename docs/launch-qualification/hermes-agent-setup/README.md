# Hermes Agent Launch Qualification Artifacts

This directory contains checked-in maintainer evidence for Hermes model
qualification runs.

Runtime policy:

- the helper uses live GonkaGate `GET /v1/models` as the runtime source of
  truth for selectable models
- artifacts in this directory are not a runtime allowlist and do not block
  live-only models from setup
- artifacts are pinned to the latest-only qualified Hermes release contract,
  currently `v2026.5.16`
- maintainer tooling for preparing sessions, building artifacts, and validating
  this tree lives under `scripts/launch-qualification/`

Artifact layout:

- one release directory per qualified Hermes release tag
- one Markdown artifact per exact GonkaGate model ID
- artifact filename slug is derived from the exact model ID and must match it

Required front matter fields:

- `modelId`
- `qualifiedOn`
- `hermesReleaseTag`
- `hermesCommit`
- `osCoverage`
- `recommended`

Required body sections:

- `## Sanitized Config Shape`
- `## Sanitized Env Shape`
- `## Basic Text Turn`
- `## Streaming Turn`
- `## Harmless Tool-Use Turn`

If an artifact is missing, malformed, or pinned to another Hermes release, the
artifact validation tooling must fail. Runtime setup does not read this tree
when deciding which live models to offer.
