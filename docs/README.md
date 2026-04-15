# Documentation Index

## Current Truth

This repository currently contains:

- the shipped onboarding runtime for `@gonkagate/hermes-agent-setup`
- the public CLI, launch qualification artifacts, and maintainer qualification
  scripts
- docs and contract tests for the shipped helper
- CI, release tooling, and mirrored contributor skills

This repository does not currently contain:

- arbitrary custom base URL support
- arbitrary custom provider management
- direct `auth.json` credential-pool mutation
- native Windows launch support

## Current Contract Documents

- [Hermes Agent Setup PRD](./specs/hermes-agent-setup-prd/spec.md)
- [How It Works](./how-it-works.md)
- [Security](./security.md)

## Qualification And Release

- [Launch Qualification Artifacts](./launch-qualification/hermes-agent-setup/README.md)
- [Release Readiness](./release-readiness/hermes-agent-setup-v1.md)

## Historical Context

- [Implementation Plan](./specs/hermes-agent-setup-prd/implementation-plan.md)
  - historical execution record from the scaffold-to-runtime transition, not
    the current product contract

## Notes

- the PRD remains the main product contract
- launch qualification artifacts are part of the shipped model-selection
  contract
- historical documents must be labeled explicitly so scaffold-era planning
  language is not mistaken for current repository truth
- `README.md` remains the public repository entrypoint
- `AGENTS.md` remains the repository operating contract
