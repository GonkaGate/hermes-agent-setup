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

test("review renderer does not require shared OPENAI_API_KEY confirmation with the dedicated GonkaGate key", async () => {
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
    assert.match(writePlanResult.result.review.text, /GONKAGATE_API_KEY/);
    assert.doesNotMatch(
      writePlanResult.result.review.text,
      /Shared OPENAI_API_KEY takeover affects/,
    );
    assert.doesNotMatch(writePlanResult.result.review.text, /Scrub matching/);
    assert.doesNotMatch(writePlanResult.result.review.text, /OPENAI_BASE_URL/);
    assert.equal(writePlanResult.result.review.confirmationRequired, false);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("canonical OPENAI_BASE_URL is not included in review cleanup", async () => {
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
    assert.doesNotMatch(writePlanResult.result.review.text, /OPENAI_BASE_URL/);

    const executionResult = await executePhaseFourWritePlan(
      writePlanResult.result,
      harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
    );

    assert.equal(executionResult.status, "written");
    assert.deepEqual(harness.readPromptInvocations().selectOptions, []);
    assert.match(
      readFileSync(resolve(harness.hermesHomeDir, ".env"), "utf8"),
      /OPENAI_BASE_URL=https:\/\/api\.gonkagate\.com\/v1/,
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY state no longer prompts before writing the dedicated GonkaGate key", async () => {
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
    );

    assert.equal(executionResult.status, "written");
    assert.deepEqual(harness.readPromptInvocations().selectOptions, []);
    assert.match(
      readFileSync(configPath, "utf8"),
      /key_env: GONKAGATE_API_KEY/,
    );
    assert.equal(
      readFileSync(envPath, "utf8"),
      "OPENAI_API_KEY=shared-upstream-key\nOPENAI_BASE_URL=https://api.other-provider.example/v1\nGONKAGATE_API_KEY=gp-phase-four-secret\n",
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
