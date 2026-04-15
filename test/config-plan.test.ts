import assert from "node:assert/strict";
import YAML from "yaml";
import test from "node:test";
import { buildConfigMutationPlan } from "../src/writes/config-plan.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadReviewPlanForFixture } from "./helpers/phase-two.js";

const selectedModelId = "qwen/qwen3-235b-a22b-instruct-2507-fp8";

test("config planner bootstraps a missing config.yaml with the exact minimal FR3 contract", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "missing-config",
  });

  try {
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const planResult = buildConfigMutationPlan({
      plannedConfigScrubs: reviewPlanResult.result.plan.plannedConfigScrubs,
      read: reviewPlanResult.result.read,
      selectedModelId,
    });

    assert.equal(planResult.ok, true);

    if (!planResult.ok) {
      return;
    }

    assert.equal(planResult.result.existedBefore, false);
    assert.deepEqual(
      planResult.result.actions.map((action) => action.fieldPath),
      ["model.provider", "model.base_url", "model.default"],
    );
    assert.deepEqual(YAML.parse(planResult.result.nextContents), {
      model: {
        base_url: "https://api.gonkagate.com/v1",
        default: selectedModelId,
        provider: "custom",
      },
    });
  } finally {
    await harness.cleanup();
  }
});

test("config planner preserves unrelated sections while rewriting only the helper-managed surface", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "review-plan-rich",
  });

  try {
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const planResult = buildConfigMutationPlan({
      plannedConfigScrubs: reviewPlanResult.result.plan.plannedConfigScrubs,
      read: reviewPlanResult.result.read,
      selectedModelId,
    });

    assert.equal(planResult.ok, true);

    if (!planResult.ok) {
      return;
    }

    const parsed = YAML.parse(planResult.result.nextContents) as Record<
      string,
      unknown
    >;

    assert.deepEqual((parsed.model as Record<string, unknown>) ?? {}, {
      base_url: "https://api.gonkagate.com/v1",
      default: selectedModelId,
      provider: "custom",
    });
    assert.deepEqual(parsed.auxiliary, {
      vision: {
        provider: "openrouter",
      },
    });
  } finally {
    await harness.cleanup();
  }
});

test("config planner leaves legacy root provider/base_url keys untouched while writing model.*", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "legacy-root-config",
  });

  try {
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const planResult = buildConfigMutationPlan({
      plannedConfigScrubs: reviewPlanResult.result.plan.plannedConfigScrubs,
      read: reviewPlanResult.result.read,
      selectedModelId,
    });

    assert.equal(planResult.ok, true);

    if (!planResult.ok) {
      return;
    }

    const parsed = YAML.parse(planResult.result.nextContents) as Record<
      string,
      unknown
    >;

    assert.equal(parsed.provider, "custom");
    assert.equal(parsed.base_url, "https://legacy-endpoint.example/v1");
    assert.deepEqual(parsed.model, {
      base_url: "https://api.gonkagate.com/v1",
      default: selectedModelId,
      provider: "custom",
    });
  } finally {
    await harness.cleanup();
  }
});

test("config planner scrubs only the allowed fields from one matching providers: entry", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "providers-dict-match",
  });

  try {
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const planResult = buildConfigMutationPlan({
      plannedConfigScrubs: reviewPlanResult.result.plan.plannedConfigScrubs,
      read: reviewPlanResult.result.read,
      selectedModelId,
    });

    assert.equal(planResult.ok, true);

    if (!planResult.ok) {
      return;
    }

    const parsed = YAML.parse(planResult.result.nextContents) as Record<
      string,
      unknown
    >;
    const providers = parsed.providers as Record<
      string,
      Record<string, unknown>
    >;

    assert.deepEqual(providers.gonkagate, {
      api: "https://api.gonkagate.com/v1",
    });
  } finally {
    await harness.cleanup();
  }
});
