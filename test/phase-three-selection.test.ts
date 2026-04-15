import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { preparePhaseThreeSelectionForFixture } from "./helpers/phase-three.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const qualificationFixtureRoot = resolve(
  testDir,
  "fixtures",
  "launch-qualification",
  "valid-single",
);

test("phase-three orchestration reaches a qualified live model choice without mutating files", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
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
    harness.queueSecretPromptResponses("gp-phase-three-secret");

    const result = await preparePhaseThreeSelectionForFixture(harness, {
      dependencyOverrides: {
        http: {
          fetch: server.createFetchOverride(),
        },
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
        sleep: async () => {},
      },
      qualificationArtifactsRoot: qualificationFixtureRoot,
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.result.selectedModel.model.modelId,
      "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    );
    assert.equal(result.result.catalog.modelIds.length, 1);
    assert.deepEqual(harness.readPromptInvocations().readSecretMessages, [
      "Enter your GonkaGate API key",
    ]);
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
    assert.equal(server.getRequestCount(), 1);
    assert.deepEqual(await harness.readFakeHermesInvocations(), [
      ["--version"],
      ["config", "path"],
      ["config", "env-path"],
    ]);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
