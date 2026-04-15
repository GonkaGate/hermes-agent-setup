import assert from "node:assert/strict";
import test from "node:test";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadReviewPlanForFixture } from "./helpers/phase-two.js";

test("builder produces one deterministic pre-write review plan", async () => {
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

    assert.deepEqual(
      reviewPlanResult.result.plan.confirmationItems.map((item) => item.kind),
      [
        "shared_openai_key_takeover",
        "file_openai_base_url_cleanup",
        "matching_provider_scrub",
      ],
    );
    assert.deepEqual(
      reviewPlanResult.result.plan.plannedConfigScrubs
        .map((scrub) => scrub.fieldPath)
        .sort(),
      [
        "model.api",
        "model.api_key",
        "model.api_mode",
        "providers.gonkagate.api_key",
        "providers.gonkagate.api_mode",
        "providers.gonkagate.transport",
      ],
    );
    assert.deepEqual(reviewPlanResult.result.plan.plannedEnvCleanup, [
      {
        confirmationRequired: true,
        existingValue: "https://api.other-provider.example/v1",
        key: "OPENAI_BASE_URL",
        reason:
          "Clear conflicting OPENAI_BASE_URL before helper-managed onboarding can be deterministic.",
        source: "file",
      },
    ]);
    assert.deepEqual(reviewPlanResult.result.plan.blockingFindings, []);
  } finally {
    await harness.cleanup();
  }
});
