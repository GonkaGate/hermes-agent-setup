import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import test from "node:test";
import type { QualifiedLiveModel } from "../src/gonkagate/qualified-models.js";
import { buildConfigMutationPlan } from "../src/writes/config-plan.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadReviewPlanForFixture } from "./helpers/phase-two.js";

const selectedModelId = "qwen/qwen3-235b-a22b-instruct-2507-fp8";
const qualifiedLiveModels = [
  createQualifiedLiveModel("minimaxai/minimax-m2.7"),
  createQualifiedLiveModel("moonshotai/kimi-k2.6"),
  createQualifiedLiveModel(selectedModelId),
] as const;

function createQualifiedLiveModel(modelId: string): QualifiedLiveModel {
  return {
    modelId,
  };
}

function expectedManagedConfig(modelId = selectedModelId) {
  return {
    model: {
      default: modelId,
      provider: "gonkagate",
    },
    providers: {
      gonkagate: {
        base_url: "https://api.gonkagate.com/v1",
        discover_models: false,
        key_env: "GONKAGATE_API_KEY",
        models: {
          "minimaxai/minimax-m2.7": {},
          "moonshotai/kimi-k2.6": {},
          "qwen/qwen3-235b-a22b-instruct-2507-fp8": {},
        },
        name: "gonkagate",
        transport: "chat_completions",
      },
    },
  };
}

test("config planner bootstraps a missing config.yaml with the named provider contract", async () => {
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
      qualifiedLiveModels,
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
      [
        "providers.gonkagate",
        "providers.gonkagate.base_url",
        "providers.gonkagate.key_env",
        "providers.gonkagate.transport",
        "providers.gonkagate.discover_models",
        "providers.gonkagate.models",
        "model.provider",
        "model.default",
      ],
    );
    assert.deepEqual(
      YAML.parse(planResult.result.nextContents),
      expectedManagedConfig(),
    );
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
      qualifiedLiveModels,
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

    assert.deepEqual(parsed.providers, expectedManagedConfig().providers);
    assert.deepEqual(parsed.model, expectedManagedConfig().model);
    assert.deepEqual(parsed.auxiliary, {
      vision: {
        provider: "openrouter",
      },
    });
  } finally {
    await harness.cleanup();
  }
});

test("config planner leaves legacy root provider/base_url keys untouched while writing named provider config", async () => {
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
      qualifiedLiveModels,
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
    assert.deepEqual(parsed.providers, expectedManagedConfig().providers);
    assert.deepEqual(parsed.model, expectedManagedConfig().model);
  } finally {
    await harness.cleanup();
  }
});

test("config planner preserves unrelated custom provider entries while managing gonkagate", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");

  try {
    await writeFile(
      configPath,
      [
        "custom_providers:",
        "  - name: other",
        "    base_url: https://other.example/v1",
        "  - name: gonkagate",
        "    base_url: https://api.gonkagate.com/v1",
        "    key_env: GONKAGATE_API_KEY",
        "    api_mode: chat_completions",
        "    models:",
        "      qwen/qwen3-235b-a22b-instruct-2507-fp8: {}",
        "",
      ].join("\n"),
      "utf8",
    );
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness);

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    const planResult = buildConfigMutationPlan({
      plannedConfigScrubs: reviewPlanResult.result.plan.plannedConfigScrubs,
      qualifiedLiveModels,
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
    assert.deepEqual(parsed.custom_providers, [
      {
        name: "other",
        base_url: "https://other.example/v1",
      },
    ]);
    assert.deepEqual(parsed.providers, expectedManagedConfig().providers);
  } finally {
    await harness.cleanup();
  }
});
