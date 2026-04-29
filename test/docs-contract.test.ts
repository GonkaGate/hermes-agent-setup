import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

test("required docs files exist", () => {
  const requiredFiles = [
    "README.md",
    "AGENTS.md",
    "RTK.md",
    "docs/README.md",
    "docs/how-it-works.md",
    "docs/security.md",
    "docs/launch-qualification/hermes-agent-setup/README.md",
    "docs/launch-qualification/hermes-agent-setup/v2026.4.13/moonshotai-kimi-k2-6.md",
    "docs/launch-qualification/hermes-agent-setup/v2026.4.13/qwen-qwen3-235b-a22b-instruct-2507-fp8.md",
    "docs/release-readiness/hermes-agent-setup-v1.md",
    "docs/specs/hermes-agent-setup-prd/spec.md",
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(
      existsSync(resolve(repoRoot, relativePath)),
      true,
      `Expected ${relativePath} to exist`,
    );
  }
});

test("README captures the shipped helper contract", () => {
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");

  assert.match(readme, /@gonkagate\/hermes-agent-setup/);
  assert.match(readme, /npx @gonkagate\/hermes-agent-setup/);
  assert.match(readme, /provider:\s*custom/);
  assert.match(readme, /https:\/\/api\.gonkagate\.com\/v1/);
  assert.match(readme, /~\/\.hermes\/config\.yaml/);
  assert.match(readme, /~\/\.hermes\/\.env/);
  assert.match(readme, /GET \/v1\/models/);
  assert.match(readme, /launch qualification artifacts/i);
  assert.match(readme, /moonshotai\/Kimi-K2\.6/);
  assert.match(readme, /qwen\/qwen3-235b-a22b-instruct-2507-fp8/);
  assert.match(readme, /United States of America|U\.S\. territories/i);
  assert.match(readme, /docs\/specs\/hermes-agent-setup-prd\/spec\.md/);
  assert.doesNotMatch(readme, /Phase 1 preflight/i);
  assert.doesNotMatch(readme, /not shipped yet/i);
});

test("AGENTS documents the shipped runtime truth and release workflow", () => {
  const agents = readFileSync(resolve(repoRoot, "AGENTS.md"), "utf8");

  assert.match(agents, /end-to-end public onboarding runtime is implemented/i);
  assert.match(agents, /launch qualification artifacts exist/i);
  assert.match(agents, /provider:\s*custom/);
  assert.match(agents, /https:\/\/api\.gonkagate\.com\/v1/);
  assert.match(agents, /Linux, macOS, and WSL2/i);
  assert.match(
    agents,
    /not positioned for users or entities in the United States/i,
  );
  assert.match(agents, /release-please/i);
  assert.match(agents, /Conventional Commits/i);
  assert.match(agents, /feat:\s+\.\.\.|feat: add/i);
  assert.match(agents, /fix:\s+\.\.\.|fix: handle/i);
  assert.doesNotMatch(
    agents,
    /public installer runtime is only partially implemented/i,
  );
});

test("agents references local RTK instructions", () => {
  const agents = readFileSync(resolve(repoRoot, "AGENTS.md"), "utf8");
  const rtk = readFileSync(resolve(repoRoot, "RTK.md"), "utf8");

  assert.match(agents, /@RTK\.md/);
  assert.match(rtk, /Always prefix shell commands with `rtk`\./);
  assert.match(rtk, /rtk proxy <cmd>/);
});

test("implementation docs capture the shipped runtime, qualification, and security boundaries", () => {
  const howItWorks = readFileSync(
    resolve(repoRoot, "docs/how-it-works.md"),
    "utf8",
  );
  const security = readFileSync(resolve(repoRoot, "docs/security.md"), "utf8");

  assert.match(howItWorks, /runtime is implemented and shipped/i);
  assert.match(howItWorks, /auth\.json/i);
  assert.match(howItWorks, /custom_providers|providers:/i);
  assert.match(
    howItWorks,
    /write `?config\.yaml`? first, write `?\.env`? second/i,
  );
  assert.match(howItWorks, /launch qualification artifacts/i);
  assert.match(howItWorks, /GET \/v1\/models/i);
  assert.doesNotMatch(howItWorks, /not implemented yet/i);

  assert.match(security, /hidden interactive\s+prompt/i);
  assert.match(security, /never write the key to `config\.yaml`/i);
  assert.match(security, /owner-only `?\.env`? permissions/i);
  assert.match(security, /does not mutate `auth\.json` credential pools/i);
  assert.match(security, /docs\/launch-qualification\/hermes-agent-setup/i);
  assert.doesNotMatch(security, /Phase 1 preflight/i);
});

test("docs index and release readiness label current versus historical surfaces clearly", () => {
  const docsIndex = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
  const readiness = readFileSync(
    resolve(repoRoot, "docs/release-readiness/hermes-agent-setup-v1.md"),
    "utf8",
  );

  assert.match(docsIndex, /Current Contract Documents/i);
  assert.match(docsIndex, /Qualification And Release/i);
  assert.match(docsIndex, /Historical Context/i);
  assert.match(docsIndex, /historical execution record/i);

  assert.match(readiness, /FR0 through FR10/i);
  assert.match(readiness, /npm run ci/);
  assert.match(readiness, /npm pack --dry-run/);
  assert.match(readiness, /qualification:artifact:validate/);
  assert.match(readiness, /moonshotai\/Kimi-K2\.6/);
  assert.match(readiness, /qwen\/qwen3-235b-a22b-instruct-2507-fp8/);
});
