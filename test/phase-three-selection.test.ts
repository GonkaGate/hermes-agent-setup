import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { join, resolve } from "node:path";
import { preparePhaseThreeSelectionForFixture } from "./helpers/phase-three.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

test("phase-three defaults to the first live catalog model and keeps its metadata", async (t) => {
  const qualificationFixtureRoot = mkdtempSync(
    join(tmpdir(), "empty-hermes-qualification-"),
  );

  t.after(() => {
    rmSync(qualificationFixtureRoot, { force: true, recursive: true });
  });
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [
        {
          context_length: 400000,
          created: 1753920000,
          description: "Fast agentic coding model.",
          id: "zeta/live-first-model",
          name: "Zeta Live First",
          object: "model",
          owned_by: "gonka",
        },
        {
          // Fields a client-side preference heuristic might have honored. The
          // helper must still take the first entry of the live response.
          default: true,
          id: "alpha/live-second-model",
          object: "model",
          recommended: true,
        },
      ],
      default: "alpha/live-second-model",
      object: "list",
    },
  });

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

    assert.deepEqual(harness.readPromptInvocations().selectOptions, [
      {
        choices: ["zeta/live-first-model", "alpha/live-second-model"],
        defaultValue: "zeta/live-first-model",
        message: "Choose the GonkaGate model to configure for Hermes Agent",
      },
    ]);
    assert.deepEqual(result.result.selectedModel.model, {
      contextLength: 400000,
      description: "Fast agentic coding model.",
      displayName: "Zeta Live First",
      modelId: "zeta/live-first-model",
    });
    assert.deepEqual(
      result.result.qualifiedLiveModels.map((model) => model.modelId),
      ["zeta/live-first-model", "alpha/live-second-model"],
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("phase-three orchestration reaches a live model choice without mutating files", async (t) => {
  const qualificationFixtureRoot = mkdtempSync(
    join(tmpdir(), "empty-hermes-qualification-"),
  );

  t.after(() => {
    rmSync(qualificationFixtureRoot, { force: true, recursive: true });
  });
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "live-only/no-artifact-model" }],
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
      "live-only/no-artifact-model",
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
