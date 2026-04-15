# Launch Qualification Scripts

These scripts support the checked-in launch qualification contract under
[`docs/launch-qualification/hermes-agent-setup/`](../../docs/launch-qualification/hermes-agent-setup/).

They are maintainer-facing tooling, not the public onboarding flow.

## What They Cover

The qualification workflow stays grounded in the shipped helper:

1. Prepare a clean `HERMES_HOME` and run the public onboarding path.
2. Save sanitized snapshots of the resulting `config.yaml` and `.env`.
3. Capture saved transcript excerpts for:
   - a basic text turn
   - a streaming turn
   - a harmless tool-use turn
4. Build the checked-in Markdown artifact for the pinned Hermes release.
5. Validate the artifact tree before merge or release handoff.

## Commands

Prepare a clean-home qualification session:

```bash
npm run qualification:prepare -- --model qwen/qwen3-235b-a22b-instruct-2507-fp8
```

This command requires `GONKAGATE_API_KEY` in the environment and writes:

- `sanitized-config.yaml`
- `sanitized-env.env`
- `review.txt`
- `prompts/*.txt`
- `transcripts/*.txt` destination paths
- `session-summary.json`

Build the checked-in artifact from that prepared session:

```bash
npm run qualification:artifact:build -- \
  --session-dir /path/to/session \
  --hermes-commit <commit-ish> \
  --recommended
```

Validate the checked-in artifact tree:

```bash
npm run qualification:artifact:validate
```

## Manual Smoke Capture

The prepare step writes prompt files for the minimum smoke suite, but it does
not take ownership of upstream Hermes runtime invocation. Maintainers should
run the equivalent Hermes commands inside the prepared `HERMES_HOME`, save the
transcript excerpts under `transcripts/`, and then build the checked-in
artifact.

That keeps the repository honest about what is helper-owned versus what is
still Hermes-owned runtime proof.
