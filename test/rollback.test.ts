import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("env write failure restores a pre-existing config.yaml from the fresh backup", async () => {
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
          if (path === envPath) {
            throw new Error("simulated env write failure");
          }

          await writeFileAtomic(path, contents, {
            encoding: "utf8",
            mode: options.mode,
          });
        },
        backupTimestamp: fixedTimestamp,
      },
    );

    assert.equal(executionResult.status, "failure");
    assert.equal(executionResult.failure.code, "env_write_failed");
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
    assert.match(
      executionResult.failure.guidance ?? "",
      /config\.yaml was restored from/i,
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("env write failure deletes a config.yaml that was first created during the same run", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "missing-config",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");

  try {
    await harness.installFakeHermesOnPath();
    harness.queueSecretPromptResponses("gp-phase-four-secret");

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
          if (path.endsWith(".env")) {
            throw new Error("simulated env write failure");
          }

          await writeFileAtomic(path, contents, {
            encoding: "utf8",
            mode: options.mode,
          });
        },
        backupTimestamp: fixedTimestamp,
      },
    );

    assert.equal(executionResult.status, "failure");
    assert.equal(executionResult.failure.code, "env_write_failed");
    assert.equal(existsSync(configPath), false);
    assert.match(
      executionResult.failure.guidance ?? "",
      /newly created config\.yaml was removed/i,
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("rollback failure surfaces explicit recovery guidance with the backup path", async () => {
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

  try {
    await harness.installFakeHermesOnPath();
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

    let configWriteCount = 0;

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
      {
        atomicWriter: async (path, contents, options) => {
          if (path === configPath) {
            configWriteCount += 1;

            if (configWriteCount > 1) {
              throw new Error("simulated rollback write failure");
            }
          }

          if (path.endsWith(".env")) {
            throw new Error("simulated env write failure");
          }

          await writeFileAtomic(path, contents, {
            encoding: "utf8",
            mode: options.mode,
          });
        },
        backupTimestamp: fixedTimestamp,
      },
    );

    assert.equal(executionResult.status, "failure");
    assert.equal(executionResult.failure.code, "rollback_failed");
    assert.match(
      executionResult.failure.guidance ?? "",
      new RegExp(`${fixedTimestamp}\\.hermes-agent-setup`),
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
