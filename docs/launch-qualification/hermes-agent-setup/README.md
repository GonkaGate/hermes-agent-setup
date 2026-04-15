# Hermes Agent Launch Qualification Artifacts

This directory is the checked-in source of truth for model allowlisting in
`@gonkagate/hermes-agent-setup`.

Runtime policy:

- only models with a checked-in artifact here may be considered allowlisted
- the helper intersects those artifacts with the live GonkaGate `/v1/models`
  catalog before presenting any model choice
- artifacts are pinned to the qualified Hermes release contract, currently
  `v2026.4.13`
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

If an artifact is missing, malformed, pinned to another Hermes release, or the
live catalog no longer contains the model, the helper must abort before any
write.
