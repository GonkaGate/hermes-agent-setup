import assert from "node:assert/strict";
import test from "node:test";
import { renderCliEntrypointError } from "../src/cli.js";
import { promptForValidatedApiKey } from "../src/ui/prompts.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

test("hidden prompt accepts a trimmed gp-prefixed API key", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    harness.queueSecretPromptResponses("  gp-phase-three-secret  ");

    const result = await promptForValidatedApiKey(
      harness.createDependencies({
        runtime: {
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(result.result.apiKey, "gp-phase-three-secret");
    assert.deepEqual(harness.readPromptInvocations().readSecretMessages, [
      "Enter your GonkaGate API key",
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("invalid prompted keys abort cleanly without leaking the raw value", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    harness.queueSecretPromptResponses("gp-secret with-space");

    const result = await promptForValidatedApiKey(
      harness.createDependencies({
        runtime: {
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "api_key_invalid");
    assert.doesNotMatch(JSON.stringify(result.failure), /gp-secret/u);
  } finally {
    await harness.cleanup();
  }
});

test("missing TTY stops the secret prompt before any input is requested", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    const result = await promptForValidatedApiKey(
      harness.createDependencies({
        runtime: {
          stdinIsTTY: false,
          stdoutIsTTY: false,
        },
      }),
    );

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "missing_tty");
    assert.deepEqual(harness.readPromptInvocations().readSecretMessages, []);
  } finally {
    await harness.cleanup();
  }
});

test("unexpected CLI errors redact raw gp keys and Bearer tokens", () => {
  const renderedError = renderCliEntrypointError(
    new Error("boom gp-secret-value Authorization: Bearer gp-secret-value"),
  );

  assert.equal(renderedError.exitCode, 1);
  assert.doesNotMatch(renderedError.stderrText ?? "", /gp-secret-value/u);
  assert.match(renderedError.stderrText ?? "", /\[REDACTED\]/u);
});
