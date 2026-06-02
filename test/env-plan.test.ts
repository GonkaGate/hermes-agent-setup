import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { buildEnvMutationPlan } from "../src/writes/env-plan.js";
import { validateGonkaGateApiKey } from "../src/validation/api-key.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import {
  loadReviewPlanForFixture,
  loadNormalizedReadForFixture,
} from "./helpers/phase-two.js";

function getValidatedApiKey() {
  const result = validateGonkaGateApiKey("gp-phase-four-secret");

  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error("Expected a valid GonkaGate API key.");
  }

  return result.apiKey;
}

test("env planner creates a new .env when the resolved file is absent", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const envPath = resolve(harness.hermesHomeDir, ".env");

  try {
    await rm(envPath);
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const plan = buildEnvMutationPlan({
      apiKey: getValidatedApiKey(),
      read: readResult.read,
    });

    assert.equal(plan.existedBefore, false);
    assert.equal(plan.nextContents, "GONKAGATE_API_KEY=gp-phase-four-secret\n");
  } finally {
    await harness.cleanup();
  }
});

test("env planner replaces GONKAGATE_API_KEY in place without disturbing unrelated key order", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const envPath = resolve(harness.hermesHomeDir, ".env");

  try {
    await writeFile(
      envPath,
      "FOO=1\nGONKAGATE_API_KEY=old-secret\nBAR=2\n",
      "utf8",
    );
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const plan = buildEnvMutationPlan({
      apiKey: getValidatedApiKey(),
      read: readResult.read,
    });

    assert.equal(plan.changed, true);
    assert.equal(
      plan.nextContents,
      "FOO=1\nGONKAGATE_API_KEY=gp-phase-four-secret\nBAR=2\n",
    );
  } finally {
    await harness.cleanup();
  }
});

test("env planner preserves canonical OPENAI_BASE_URL residue outside helper ownership", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "canonical-base-url",
  });

  try {
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const plan = buildEnvMutationPlan({
      apiKey: getValidatedApiKey(),
      read: reviewPlanResult.result.read,
    });

    assert.deepEqual(
      plan.actions.map((action) => `${action.kind}:${action.key}`),
      ["set:GONKAGATE_API_KEY"],
    );
    assert.equal(
      plan.nextContents,
      "OPENAI_BASE_URL=https://api.gonkagate.com/v1\nGONKAGATE_API_KEY=gp-phase-four-secret\n",
    );
  } finally {
    await harness.cleanup();
  }
});

test("env planner preserves non-canonical OPENAI_BASE_URL and shared OPENAI_API_KEY while writing the dedicated key", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-conflict",
  });
  const envPath = resolve(harness.hermesHomeDir, ".env");

  try {
    await writeFile(
      envPath,
      "FOO=1\nOPENAI_API_KEY=shared-upstream-key\nOPENAI_BASE_URL=https://api.other-provider.example/v1\nBAR=2\n",
      "utf8",
    );
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const plan = buildEnvMutationPlan({
      apiKey: getValidatedApiKey(),
      read: reviewPlanResult.result.read,
    });

    assert.equal(
      plan.nextContents,
      "FOO=1\nOPENAI_API_KEY=shared-upstream-key\nOPENAI_BASE_URL=https://api.other-provider.example/v1\nBAR=2\nGONKAGATE_API_KEY=gp-phase-four-secret\n",
    );
  } finally {
    await harness.cleanup();
  }
});
