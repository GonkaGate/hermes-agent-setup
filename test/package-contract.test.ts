import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

const packageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "package.json"), "utf8"),
) as {
  name: string;
  description: string;
  type: string;
  scripts: Record<string, string>;
  bin: Record<string, string>;
  files: string[];
  engines: { node?: string };
};

test("package contract matches the shipped public metadata", () => {
  assert.equal(packageJson.name, "@gonkagate/hermes-agent-setup");
  assert.match(packageJson.description, /onboarding helper/i);
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.engines.node, ">=22.14.0");

  assert.equal(
    packageJson.bin["hermes-agent-setup"],
    "bin/gonkagate-hermes-agent-setup.js",
  );
  assert.equal(
    packageJson.bin["gonkagate-hermes-agent-setup"],
    "bin/gonkagate-hermes-agent-setup.js",
  );

  assert.equal(packageJson.scripts.build, "tsc -p tsconfig.build.json");
  assert.equal(packageJson.scripts.typecheck, "tsc -p tsconfig.json");
  assert.equal(
    packageJson.scripts.test,
    "npm run build && node scripts/run-tests.mjs",
  );
  assert.equal(
    packageJson.scripts["qualification:prepare"],
    "npm run build && node scripts/launch-qualification/prepare-clean-home.mjs",
  );
  assert.equal(
    packageJson.scripts["qualification:artifact:build"],
    "node scripts/launch-qualification/build-artifact.mjs",
  );
  assert.equal(
    packageJson.scripts["qualification:artifact:validate"],
    "node scripts/launch-qualification/validate-artifacts.mjs",
  );
  assert.equal(
    packageJson.scripts.ci,
    "npm run typecheck && npm run test && npm run qualification:artifact:validate && npm run format:check && npm run package:check",
  );

  assert.deepEqual(packageJson.files, [
    "bin",
    "dist",
    "docs",
    "scripts",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ]);
});
