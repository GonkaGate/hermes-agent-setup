import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const agentSkillsRoot = resolve(repoRoot, ".agents", "skills");
const claudeSkillsRoot = resolve(repoRoot, ".claude", "skills");

function collectRelativeFiles(root: string, prefix = ""): string[] {
  const entries = readdirSync(resolve(root, prefix), {
    withFileTypes: true,
  }).sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...collectRelativeFiles(root, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

test("mirrored contributor skills exist", () => {
  assert.equal(
    existsSync(agentSkillsRoot),
    true,
    "Expected .agents/skills to exist",
  );
  assert.equal(
    existsSync(claudeSkillsRoot),
    true,
    "Expected .claude/skills to exist",
  );

  const entries = readdirSync(agentSkillsRoot, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );

  assert.ok(
    entries.length >= 10,
    "Expected a non-trivial mirrored skill catalog",
  );
  assert.equal(
    existsSync(resolve(agentSkillsRoot, "typescript-coder", "SKILL.md")),
    true,
    "Expected typescript-coder to be mirrored",
  );
  assert.equal(
    existsSync(
      resolve(
        agentSkillsRoot,
        "verification-before-completion",
        "HYPERRESEARCH_PROMPT.md",
      ),
    ),
    true,
    "Expected verification-before-completion support files to be mirrored",
  );
});

test(".claude skills mirror .agents skills", () => {
  const agentFiles = collectRelativeFiles(agentSkillsRoot);
  const claudeFiles = collectRelativeFiles(claudeSkillsRoot);

  assert.deepEqual(claudeFiles, agentFiles);

  for (const relativePath of agentFiles) {
    assert.equal(
      readFileSync(resolve(claudeSkillsRoot, relativePath), "utf8"),
      readFileSync(resolve(agentSkillsRoot, relativePath), "utf8"),
      `Expected mirrored skill file ${relativePath} to stay in sync`,
    );
  }
});

test("coding-prompt-normalizer is adapted to hermes-agent-setup", () => {
  const normalizerRoot = resolve(agentSkillsRoot, "coding-prompt-normalizer");
  const combined = [
    readFileSync(resolve(normalizerRoot, "SKILL.md"), "utf8"),
    readFileSync(
      resolve(normalizerRoot, "references", "input-normalization.md"),
      "utf8",
    ),
    readFileSync(
      resolve(normalizerRoot, "references", "repo-context-routing.md"),
      "utf8",
    ),
    readFileSync(resolve(normalizerRoot, "evals", "evals.json"), "utf8"),
  ].join("\n");

  assert.match(combined, /hermes-agent-setup/);
  assert.match(combined, /~\/\.hermes\/config\.yaml/);
  assert.match(combined, /~\/\.hermes\/\.env/);
  assert.match(combined, /provider: custom/);
  assert.match(combined, /https:\/\/api\.gonkagate\.com\/v1/);
  assert.match(combined, /launch-qualification\/hermes-agent-setup/);
  assert.match(combined, /shipped runtime|shipped helper/i);

  assert.doesNotMatch(combined, /opencode/i);
  assert.doesNotMatch(combined, /~\/\.config\/opencode\/opencode\.json/);
  assert.doesNotMatch(combined, /provider\.gonkagate/);
  assert.doesNotMatch(combined, /src\/install\//);
  assert.doesNotMatch(combined, /chat_completions/);
  assert.doesNotMatch(combined, /scaffold-only|not implemented yet/i);
});

test("code-simplification is adapted to hermes-agent-setup's shipped runtime", () => {
  const simplificationRoot = resolve(agentSkillsRoot, "code-simplification");
  const combined = readFileSync(
    resolve(simplificationRoot, "SKILL.md"),
    "utf8",
  );

  assert.equal(existsSync(resolve(simplificationRoot, "SKILL.md")), true);
  assert.match(combined, /hermes-agent-setup/);
  assert.match(combined, /shipped-runtime reality/i);
  assert.match(combined, /shipped[\s-]+helper contract/i);
  assert.match(combined, /npm run ci/);

  assert.doesNotMatch(combined, /opencode-setup/i);
  assert.doesNotMatch(combined, /runtime is not yet implemented/i);
});

test("hermes-compatibility-audit is adapted to hermes-agent-setup", () => {
  const auditRoot = resolve(agentSkillsRoot, "hermes-compatibility-audit");
  const combined = [
    readFileSync(resolve(auditRoot, "SKILL.md"), "utf8"),
    readFileSync(
      resolve(auditRoot, "references", "report-template.md"),
      "utf8",
    ),
  ].join("\n");

  assert.equal(existsSync(resolve(auditRoot, "SKILL.md")), true);
  assert.match(combined, /hermes-agent-setup/);
  assert.match(combined, /latest stable upstream `hermes-agent` release/);
  assert.match(combined, /~\/\.hermes\/config\.yaml/);
  assert.match(combined, /provider: custom/);
  assert.match(
    combined,
    /https:\/\/github\.com\/NousResearch\/hermes-agent\/releases/,
  );
  assert.match(
    combined,
    /https:\/\/hermes-agent\.nousresearch\.com\/docs\/user-guide\/configuration\//,
  );
  assert.match(combined, /current shipped-runtime truthfulness/i);

  assert.doesNotMatch(combined, /opencode/i);
  assert.doesNotMatch(combined, /~\/\.config\/opencode\/opencode\.json/);
  assert.doesNotMatch(combined, /provider\.gonkagate/);
  assert.doesNotMatch(combined, /chat_completions/);
  assert.doesNotMatch(
    combined,
    /https:\/\/opencode\.ai\/docs\/|opencode-ai|OpenCode Compatibility Audit/,
  );
});

test("planning-and-task-breakdown is adapted to hermes-agent-setup", () => {
  const planningRoot = resolve(agentSkillsRoot, "planning-and-task-breakdown");
  const combined = readFileSync(resolve(planningRoot, "SKILL.md"), "utf8");

  assert.equal(existsSync(resolve(planningRoot, "SKILL.md")), true);
  assert.match(combined, /hermes-agent-setup/);
  assert.match(combined, /docs\/specs\/hermes-agent-setup-prd\/spec\.md/);
  assert.match(combined, /provider: custom/);
  assert.match(combined, /https:\/\/api\.gonkagate\.com\/v1/);
  assert.match(combined, /~\/\.hermes\/\.env/);
  assert.match(combined, /npm run ci/);
  assert.match(combined, /\.agents\/skills\/.*\.claude\/skills\//s);
  assert.match(combined, /public installer runtime is implemented/i);
  assert.match(combined, /launch qualification artifacts/i);

  assert.doesNotMatch(combined, /opencode/i);
  assert.doesNotMatch(combined, /docs\/specs\/opencode-setup-prd\/spec\.md/);
  assert.doesNotMatch(combined, /~\/\.config\/opencode\/opencode\.json/);
  assert.doesNotMatch(combined, /scaffold|not implemented yet/i);
});
