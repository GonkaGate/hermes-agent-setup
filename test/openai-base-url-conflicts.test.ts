import assert from "node:assert/strict";
import test from "node:test";
import { classifyOpenAiBaseUrlConflicts } from "../src/hermes/conflicts/openai-base-url.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadNormalizedReadForFixture } from "./helpers/phase-two.js";

test("OPENAI_BASE_URL classifier plans cleanup for file-backed canonical residue", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "canonical-base-url",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(classifyOpenAiBaseUrlConflicts(readResult.read), [
      {
        canonicalValue: "https://api.gonkagate.com/v1",
        kind: "openai_base_url",
        resolution: "clear_file_value_without_confirmation",
        source: "file",
        status: "planned_cleanup",
        value: "https://api.gonkagate.com/v1",
      },
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("OPENAI_BASE_URL classifier requires confirmation for file-backed non-canonical values", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-conflict",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const [conflict] = classifyOpenAiBaseUrlConflicts(readResult.read);

    assert.equal(conflict?.status, "confirmation_required");
    assert.equal(conflict?.source, "file");
  } finally {
    await harness.cleanup();
  }
});

test("OPENAI_BASE_URL classifier surfaces inherited canonical values as advisories", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        runtime: {
          env: {
            OPENAI_BASE_URL: "https://api.gonkagate.com/v1",
          },
        },
      },
    });

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(classifyOpenAiBaseUrlConflicts(readResult.read), [
      {
        canonicalValue: "https://api.gonkagate.com/v1",
        kind: "openai_base_url",
        resolution: "warn_same_shell_runtime",
        source: "inherited_process",
        status: "advisory",
        value: "https://api.gonkagate.com/v1",
      },
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("OPENAI_BASE_URL classifier blocks inherited non-canonical values", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        runtime: {
          env: {
            OPENAI_BASE_URL: "https://api.other-provider.example/v1",
          },
        },
      },
    });

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(classifyOpenAiBaseUrlConflicts(readResult.read), [
      {
        canonicalValue: "https://api.gonkagate.com/v1",
        kind: "openai_base_url",
        resolution: "unset_shell_and_rerun",
        source: "inherited_process",
        status: "blocking",
        value: "https://api.other-provider.example/v1",
      },
    ]);
  } finally {
    await harness.cleanup();
  }
});
