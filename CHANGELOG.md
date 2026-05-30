# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0](https://github.com/GonkaGate/hermes-agent-setup/compare/v1.0.0...v1.1.0) (2026-05-29)


### Features

* add minimax m2.7 hermes qualification ([4db093e](https://github.com/GonkaGate/hermes-agent-setup/commit/4db093eae123daf1577ecaf94544bade88b00db7))
* add minimax m2.7 hermes qualification ([ae9969d](https://github.com/GonkaGate/hermes-agent-setup/commit/ae9969d7b4007d1d1232a0c035c19976df8e7241))

## [1.0.0](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.2.1...v1.0.0) (2026-05-24)


### ⚠ BREAKING CHANGES

* Hermes versions below v0.14.0 and legacy endpoint paths such as OPENAI_BASE_URL, LLM_MODEL, root-level provider/base_url, and legacy custom_providers are no longer supported by the helper.

### Features

* target latest Hermes contract ([f3beac3](https://github.com/GonkaGate/hermes-agent-setup/commit/f3beac39bce473f2b1245973d092a657b9bc281e))

## [0.2.1](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.2.0...v0.2.1) (2026-05-16)


### Bug Fixes

* align kimi qualification artifact id ([54b7e03](https://github.com/GonkaGate/hermes-agent-setup/commit/54b7e03f1fbafa8d3ee08828dfb974e316f904b7))
* align kimi qualification artifact id ([fd69f72](https://github.com/GonkaGate/hermes-agent-setup/commit/fd69f726bd1817090f16c7722113f0a9374786d3))

## [0.2.0](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.1.3...v0.2.0) (2026-04-29)


### Features

* add Kimi K2.6 launch qualification ([0575946](https://github.com/GonkaGate/hermes-agent-setup/commit/0575946304b64cd6bd9beca3b9b114bd7b93ef06))
* add Kimi K2.6 launch qualification ([9edd5bd](https://github.com/GonkaGate/hermes-agent-setup/commit/9edd5bdaf724bf053ea53b14481241eb80998e6f))

## [0.1.3](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.1.2...v0.1.3) (2026-04-16)

### Bug Fixes

- support `NPM_TOKEN` fallback for npm publish automation when trusted publishing is unavailable

## [0.1.2](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.1.1...v0.1.2) (2026-04-16)

### Bug Fixes

- keep generated changelog out of prettier checks ([cc59ef4](https://github.com/GonkaGate/hermes-agent-setup/commit/cc59ef4a4e0bcb985168be597b373b8916b0d80a))

## [0.1.1](https://github.com/GonkaGate/hermes-agent-setup/compare/v0.1.0...v0.1.1) (2026-04-15)


### Bug Fixes

* release merged Windows CI stabilization ([7f81ffb](https://github.com/GonkaGate/hermes-agent-setup/commit/7f81ffb6471eef69bf5a6521093f5480b482515b))

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
