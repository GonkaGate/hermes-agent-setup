import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chmod, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import writeFileAtomic from "write-file-atomic";
import { executePhaseFourWritePlan } from "../src/commands/phase-four.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { buildPhaseFourWritePlanForFixture } from "./helpers/phase-four.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const qualificationFixtureRoot = resolve(
  testDir,
  "fixtures",
  "launch-qualification",
  "valid-single",
);
const fixedTimestamp = "20260415T010203Z";

function createStandardDependencyOverrides(
  fetchOverride: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return {
    http: {
      fetch: fetchOverride,
    },
    runtime: {
      osRelease: "6.8.0",
      platform: "linux" as const,
      stdinIsTTY: true,
      stdoutIsTTY: true,
    },
    sleep: async () => {},
  };
}

test("phase-four execution creates deterministic backups, writes config first, and enforces owner-only env permissions", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "review-plan-rich",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");
  const envPath = resolve(harness.hermesHomeDir, ".env");
  const beforeConfig = readFileSync(configPath, "utf8");
  const beforeEnv = readFileSync(envPath, "utf8");
  const writeOrder: string[] = [];

  try {
    await harness.installFakeHermesOnPath();
    await chmod(envPath, 0o644);
    harness.queueSecretPromptResponses("gp-phase-four-secret");
    harness.queueSelectionResponses("continue");

    const writePlanResult = await buildPhaseFourWritePlanForFixture(harness, {
      dependencyOverrides: createStandardDependencyOverrides(
        server.createFetchOverride(),
      ),
      qualificationArtifactsRoot: qualificationFixtureRoot,
    });

    assert.equal(writePlanResult.ok, true);

    if (!writePlanResult.ok) {
      return;
    }

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
      {
        atomicWriter: async (path, contents, options) => {
          writeOrder.push(path);
          await writeFileAtomic(path, contents, {
            encoding: "utf8",
            mode: options.mode,
          });
        },
        backupTimestamp: fixedTimestamp,
      },
    );

    assert.equal(executionResult.status, "written");
    assert.deepEqual(writeOrder, [configPath, envPath]);
    assert.equal(
      readFileSync(
        `${configPath}.bak.${fixedTimestamp}.hermes-agent-setup`,
        "utf8",
      ),
      beforeConfig,
    );
    assert.equal(
      readFileSync(
        `${envPath}.bak.${fixedTimestamp}.hermes-agent-setup`,
        "utf8",
      ),
      beforeEnv,
    );
    assert.equal((await stat(envPath)).mode & 0o777, 0o600);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("backup collision aborts before any file write starts", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "review-plan-rich",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");
  const envPath = resolve(harness.hermesHomeDir, ".env");
  const beforeConfig = readFileSync(configPath, "utf8");
  const beforeEnv = readFileSync(envPath, "utf8");

  try {
    await harness.installFakeHermesOnPath();
    await writeFile(
      `${configPath}.bak.${fixedTimestamp}.hermes-agent-setup`,
      "collision",
      "utf8",
    );
    harness.queueSecretPromptResponses("gp-phase-four-secret");
    harness.queueSelectionResponses("continue");

    const writePlanResult = await buildPhaseFourWritePlanForFixture(harness, {
      dependencyOverrides: createStandardDependencyOverrides(
        server.createFetchOverride(),
      ),
      qualificationArtifactsRoot: qualificationFixtureRoot,
    });

    assert.equal(writePlanResult.ok, true);

    if (!writePlanResult.ok) {
      return;
    }

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
      {
        backupTimestamp: fixedTimestamp,
      },
    );

    assert.equal(executionResult.status, "failure");
    assert.equal(executionResult.failure.code, "backup_failed");
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
