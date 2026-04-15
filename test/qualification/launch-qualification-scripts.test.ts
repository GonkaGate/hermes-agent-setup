import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("build-artifact writes a checked-in markdown artifact with sanitized excerpts", (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "hermes-qualification-build-"));

  t.after(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  const configPath = join(tempDir, "config.yaml");
  const envPath = join(tempDir, ".env");
  const basicLogPath = join(tempDir, "basic.txt");
  const streamLogPath = join(tempDir, "streaming.txt");
  const toolLogPath = join(tempDir, "tool.txt");
  const outputPath = join(tempDir, "qwen-qwen3-235b-a22b-instruct-2507-fp8.md");

  writeFileSync(
    configPath,
    "model:\n  provider: custom\n  base_url: https://api.gonkagate.com/v1\n  default: qwen/qwen3-235b-a22b-instruct-2507-fp8\n",
    "utf8",
  );
  writeFileSync(envPath, "OPENAI_API_KEY=gp-super-secret\n", "utf8");
  writeFileSync(
    basicLogPath,
    "assistant: GonkaGate Hermes qualification text ok\nAuthorization: Bearer sk-test-token\n",
    "utf8",
  );
  writeFileSync(streamLogPath, "stream chunk 1\nstream chunk 2\n", "utf8");
  writeFileSync(toolLogPath, "tool: pwd\nresult: /tmp/hermes-home\n", "utf8");

  const result = spawnSync(
    process.execPath,
    [
      "scripts/launch-qualification/build-artifact.mjs",
      "--model-id",
      "qwen/qwen3-235b-a22b-instruct-2507-fp8",
      "--hermes-commit",
      "abc123",
      "--qualified-on",
      "2026-04-15",
      "--config",
      configPath,
      "--env",
      envPath,
      "--basic-log",
      basicLogPath,
      "--stream-log",
      streamLogPath,
      "--tool-log",
      toolLogPath,
      "--out",
      outputPath,
      "--recommended",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);

  const artifact = readFileSync(outputPath, "utf8");

  assert.match(artifact, /modelId: qwen\/qwen3-235b-a22b-instruct-2507-fp8/);
  assert.match(artifact, /recommended: true/);
  assert.match(artifact, /## Sanitized Config Shape/);
  assert.match(artifact, /## Basic Text Turn/);
  assert.match(artifact, /\[REDACTED\]/);
  assert.doesNotMatch(artifact, /gp-super-secret/);
  assert.doesNotMatch(artifact, /Bearer sk-test-token/);
});

test("prepare-clean-home exposes maintainer-facing help text without running the runtime", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/launch-qualification/prepare-clean-home.mjs", "--help"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /Prepare a clean Hermes home for launch qualification/i,
  );
  assert.match(result.stdout, /GONKAGATE_API_KEY/);
  assert.match(result.stdout, /build-artifact\.mjs/);
});

test("validate-artifacts accepts the checked-in artifact tree and rejects malformed fixtures", () => {
  const validResult = spawnSync(
    process.execPath,
    ["scripts/launch-qualification/validate-artifacts.mjs"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  const invalidResult = spawnSync(
    process.execPath,
    [
      "scripts/launch-qualification/validate-artifacts.mjs",
      "--root",
      "test/fixtures/launch-qualification/bad-front-matter",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(validResult.status, 0, validResult.stderr);
  assert.match(
    validResult.stdout,
    /Validated \d+ launch qualification artifact/,
  );
  assert.notEqual(invalidResult.status, 0);
  assert.match(
    invalidResult.stderr,
    /invalid front matter YAML|missing front matter/i,
  );
});
