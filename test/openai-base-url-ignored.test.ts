import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadReviewPlanForFixture } from "./helpers/phase-two.js";

test("OPENAI_BASE_URL is ignored by latest-only review planning", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const envPath = resolve(harness.hermesHomeDir, ".env");

  try {
    await writeFile(
      envPath,
      "OPENAI_BASE_URL=https://api.other-provider.example/v1\n",
      "utf8",
    );
    await harness.installFakeHermesOnPath();

    const reviewPlanResult = await loadReviewPlanForFixture(harness, {
      dependencyOverrides: {
        runtime: {
          env: {
            OPENAI_BASE_URL: "https://api.shell-provider.example/v1",
          },
        },
      },
    });

    assert.equal(reviewPlanResult.ok, true);

    if (!reviewPlanResult.ok) {
      return;
    }

    assert.deepEqual(reviewPlanResult.result.plan.blockingFindings, []);
    assert.deepEqual(reviewPlanResult.result.plan.confirmationItems, []);
    assert.deepEqual(reviewPlanResult.result.plan.plannedConfigScrubs, []);
  } finally {
    await harness.cleanup();
  }
});
