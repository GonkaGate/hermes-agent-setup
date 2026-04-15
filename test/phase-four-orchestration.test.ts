import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
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

test("phase-four orchestration can build and apply the mutation plan end to end", async () => {
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
    );

    assert.equal(executionResult.status, "written");
    assert.deepEqual(YAML.parse(readFileSync(configPath, "utf8")), {
      auxiliary: {
        vision: {
          provider: "openrouter",
        },
      },
      model: {
        base_url: "https://api.gonkagate.com/v1",
        default: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
        provider: "custom",
      },
      providers: {
        gonkagate: {
          api: "https://api.gonkagate.com/v1",
        },
      },
    });
    assert.equal(
      readFileSync(envPath, "utf8"),
      "OPENAI_API_KEY=gp-phase-four-secret\n",
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
