import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { run } from "../src/cli.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

interface BufferWriter {
  contents: string;
  write(text: string): void;
}

function createBufferWriter(): BufferWriter {
  return {
    contents: "",
    write(text) {
      this.contents += text;
    },
  };
}

function createStandardDependencyOverrides(
  fetchOverride?: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return {
    ...(fetchOverride === undefined
      ? {}
      : {
          http: {
            fetch: fetchOverride,
          },
        }),
    runtime: {
      osRelease: "6.8.0",
      platform: "linux" as const,
      stdinIsTTY: true,
      stdoutIsTTY: true,
    },
    sleep: async () => {},
  };
}

test("declining the consolidated confirmation cancels the public flow without touching Hermes files", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "review-plan-rich",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");
  const envPath = resolve(harness.hermesHomeDir, ".env");
  const beforeConfig = readFileSync(configPath, "utf8");
  const beforeEnv = readFileSync(envPath, "utf8");

  try {
    await harness.installFakeHermesOnPath();
    harness.queueSecretPromptResponses("gp-e2e-secret");
    harness.queueSelectionResponses("cancel");

    const result = await run([], {
      dependencies: harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
      stderr,
      stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.result?.status, "cancelled");
    assert.match(stdout.contents, /GonkaGate onboarding review/);
    assert.match(stdout.contents, /GonkaGate onboarding cancelled\./);
    assert.equal(stderr.contents, "");
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("shell-owned non-canonical OPENAI_BASE_URL blocks before prompting for a secret", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();

  try {
    await harness.installFakeHermesOnPath();

    const result = await run([], {
      dependencies: harness.createDependencies({
        runtime: {
          env: {
            OPENAI_BASE_URL: "https://api.other-provider.example/v1",
          },
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
      stderr,
      stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.result?.status, "failure");
    assert.equal(result.result?.code, "inherited_base_url_conflict");
    assert.match(stdout.contents, /Unset OPENAI_BASE_URL/i);
    assert.deepEqual(harness.readPromptInvocations().readSecretMessages, []);
  } finally {
    await harness.cleanup();
  }
});

test("quota-shaped live catalog failures abort the public flow before any file write", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      error: {
        code: "insufficient_quota",
      },
    },
    statusCode: 429,
  });
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");
  const envPath = resolve(harness.hermesHomeDir, ".env");
  const beforeConfig = readFileSync(configPath, "utf8");
  const beforeEnv = readFileSync(envPath, "utf8");

  try {
    await harness.installFakeHermesOnPath();
    harness.queueSecretPromptResponses("gp-e2e-secret");

    const result = await run([], {
      dependencies: harness.createDependencies(
        createStandardDependencyOverrides(server.createFetchOverride()),
      ),
      stderr,
      stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.result?.status, "failure");
    assert.equal(result.result?.code, "catalog_auth_failed");
    assert.match(stdout.contents, /billing state/i);
    assert.equal(stderr.contents, "");
    assert.equal(readFileSync(configPath, "utf8"), beforeConfig);
    assert.equal(readFileSync(envPath, "utf8"), beforeEnv);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
