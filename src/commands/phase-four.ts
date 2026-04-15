import type { PhaseThreeSelectionReady } from "../domain/phase-three.js";
import type { OnboardFailure } from "../domain/runtime.js";
import type {
  PhaseFourExecutionResult,
  PhaseFourWritePlan,
} from "../domain/writes.js";
import { confirmPhaseFourReview } from "../planning/confirmation.js";
import { createPreWriteBlockingFailure } from "../planning/blocking-failures.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import { createPhaseFourReview } from "../ui/review.js";
import { buildConfigMutationPlan } from "../writes/config-plan.js";
import { buildEnvMutationPlan } from "../writes/env-plan.js";
import {
  executePlannedWrites,
  type ExecuteWritePlanOptions,
} from "../writes/execute-plan.js";

export function buildPhaseFourWritePlan(selection: PhaseThreeSelectionReady):
  | {
      ok: true;
      result: PhaseFourWritePlan;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    } {
  const blockingFailure = createPreWriteBlockingFailure(
    selection.reviewPlan.plan.blockingFindings[0],
  );

  if (blockingFailure !== undefined) {
    return {
      failure: blockingFailure,
      ok: false,
    };
  }

  const configPlanResult = buildConfigMutationPlan({
    plannedConfigScrubs: selection.reviewPlan.plan.plannedConfigScrubs,
    read: selection.reviewPlan.read,
    selectedModelId: selection.selectedModel.model.modelId,
  });

  if (!configPlanResult.ok) {
    return configPlanResult;
  }

  const envPlan = buildEnvMutationPlan({
    apiKey: selection.apiKey,
    plannedEnvCleanup: selection.reviewPlan.plan.plannedEnvCleanup,
    read: selection.reviewPlan.read,
  });
  const review = createPhaseFourReview({
    configPath: selection.preflight.configPath,
    configPlan: configPlanResult.result,
    envPath: selection.preflight.envPath,
    envPlan,
    reviewPlan: selection.reviewPlan.plan,
    selectedModelId: selection.selectedModel.model.modelId,
  });

  return {
    ok: true,
    result: {
      config: configPlanResult.result,
      env: envPlan,
      review,
      reviewPlan: selection.reviewPlan.plan,
      selectedModelId: selection.selectedModel.model.modelId,
    },
  };
}

export async function executePhaseFourWritePlan(
  writePlan: PhaseFourWritePlan,
  dependencies: OnboardDependencies,
  options: ExecuteWritePlanOptions = {},
): Promise<PhaseFourExecutionResult> {
  const confirmationResult = await confirmPhaseFourReview(
    writePlan.review,
    dependencies,
  );

  if (!confirmationResult.ok) {
    return {
      failure: confirmationResult.failure,
      ok: false,
      reviewText: writePlan.review.text,
      status: "failure",
    };
  }

  if (!confirmationResult.confirmed) {
    return {
      ok: false,
      reviewText: writePlan.review.text,
      status: "cancelled",
    };
  }

  const executionResult = await executePlannedWrites(
    writePlan,
    dependencies,
    options,
  );

  if (!executionResult.ok) {
    return {
      failure: executionResult.failure,
      ok: false,
      reviewText: writePlan.review.text,
      status: "failure",
    };
  }

  return {
    ok: true,
    result: executionResult.result,
    status: "written",
  };
}
