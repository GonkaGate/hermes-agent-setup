# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-16

### Added

- public onboarding CLI for configuring `hermes-agent` to use GonkaGate as
  the primary OpenAI-compatible endpoint through
  `npx @gonkagate/hermes-agent-setup`
- Hermes-aware path resolution for the active context and explicit
  `--profile <name>` targeting
- preflight guards for supported platforms, Node, TTY, Hermes availability,
  and managed installs before prompting or writing
- normalized Hermes state loading for `config.yaml`, `.env`, `auth.json`, and
  `cron/jobs.json`
- conflict classification for shared `OPENAI_API_KEY`,
  `OPENAI_BASE_URL`, matching provider entries, and matching auth pools
- hidden GonkaGate `gp-...` key prompt with redaction of secrets in diagnostic
  error paths
- live `/v1/models` catalog fetch with checked-in launch qualification
  artifact intersection and curated model selection
- minimal managed write surface for `model.provider`, `model.base_url`,
  `model.default`, and `OPENAI_API_KEY`
- deterministic backup, write ordering, and rollback behavior for
  `config.yaml` and `.env`
- checked-in launch qualification artifacts, maintainer qualification scripts,
  public security docs, and v1 release-readiness notes
- fixture-driven TypeScript test coverage for CLI contracts, path resolution,
  preconditions, conflict handling, model qualification, write planning,
  rollback, docs truthfulness, and mirrored contributor skills
- CI, publish, and `release-please` automation for the npm package
