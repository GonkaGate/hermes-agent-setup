import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
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

test("review renderer produces one consolidated block with takeover, base-url cleanup, and provider scrub details", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "review-plan-rich",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });

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

    assert.match(
      writePlanResult.result.review.text,
      /GonkaGate onboarding review/,
    );
    assert.match(
      writePlanResult.result.review.text,
      /Selected model: qwen\/qwen3-235b-a22b-instruct-2507-fp8/,
    );
    assert.match(
      writePlanResult.result.review.text,
      /Shared OPENAI_API_KEY takeover affects/,
    );
    assert.match(
      writePlanResult.result.review.text,
      /Clear file-backed OPENAI_BASE_URL=https:\/\/api\.other-provider\.example\/v1/,
    );
    assert.match(
      writePlanResult.result.review.text,
      /Scrub matching provider "gonkagate" fields: api_key, api_mode, transport/,
    );
    assert.equal(writePlanResult.result.review.confirmationRequired, true);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("canonical OPENAI_BASE_URL cleanup appears in review output but skips confirmation", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "canonical-base-url",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });

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

    assert.equal(writePlanResult.result.review.confirmationRequired, false);
    assert.match(writePlanResult.result.review.text, /Clear OPENAI_BASE_URL/);

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
    );

    assert.equal(executionResult.status, "written");
    assert.deepEqual(harness.readPromptInvocations().selectOptions, []);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("declining the consolidated confirmation exits without touching any file", async () => {
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

    harness.queueSelectionResponses("cancel");

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
    );

    assert.equal(executionResult.status, "cancelled");
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
