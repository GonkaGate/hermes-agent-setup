import type { OutputWriter } from "../cli/contracts.js";
import type { OnboardCliOptions, OnboardResult } from "../domain/runtime.js";
import {
  buildPhaseFourWritePlan,
  executePhaseFourWritePlan,
} from "./phase-four.js";
import { preparePhaseThreeSelection } from "./phase-three.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export async function runOnboardCommand(
  options: OnboardCliOptions,
  dependencies: OnboardDependencies,
  output?: OutputWriter,
): Promise<OnboardResult> {
  const phaseThreeResult = await preparePhaseThreeSelection(
    options,
    dependencies,
  );

  if (!phaseThreeResult.ok) {
    return phaseThreeResult.failure;
  }

  const writePlanResult = buildPhaseFourWritePlan(phaseThreeResult.result);

  if (!writePlanResult.ok) {
    return writePlanResult.failure;
  }

  if (writePlanResult.result.review.text.length > 0) {
    output?.write(writePlanResult.result.review.text);
  }

  const executionResult = await executePhaseFourWritePlan(
    writePlanResult.result,
    dependencies,
  );

  if (executionResult.status === "failure") {
    return executionResult.failure;
  }

  if (executionResult.status === "cancelled") {
    return {
      message:
        "The planned GonkaGate onboarding changes were cancelled before any Hermes files were modified.",
      preflight: phaseThreeResult.result.preflight,
      reviewText: executionResult.reviewText,
      status: "cancelled",
    };
  }

  return {
    preflight: phaseThreeResult.result.preflight,
    reviewPlan: writePlanResult.result.reviewPlan,
    selectedModelId: writePlanResult.result.selectedModelId,
    status: "success",
    writeResult: executionResult.result,
  };
}
