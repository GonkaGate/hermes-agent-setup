import {
  createOnboardFailure,
  type OnboardCliOptions,
} from "../domain/runtime.js";
import type { PhaseThreeSelectionResult } from "../domain/phase-three.js";
import { fetchGonkaGateLiveCatalog } from "../gonkagate/catalog-client.js";
import { loadQualifiedLiveModels } from "../gonkagate/qualified-models.js";
import { createPreWriteBlockingFailure } from "../planning/blocking-failures.js";
import { loadPreWriteReviewPlanForContext } from "../planning/review-plan-builder.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import { runPreflightChecks } from "../runtime/preconditions.js";
import { selectQualifiedModel } from "../ui/model-picker.js";
import { promptForValidatedApiKey } from "../ui/prompts.js";

export interface PreparePhaseThreeSelectionOptions {
  qualificationArtifactsRoot?: string;
}

export async function preparePhaseThreeSelection(
  options: OnboardCliOptions,
  dependencies: OnboardDependencies,
  phaseThreeOptions: PreparePhaseThreeSelectionOptions = {},
): Promise<PhaseThreeSelectionResult> {
  const preflightResult = await runPreflightChecks(options, dependencies);

  if (preflightResult.status !== "success-preflight") {
    return {
      failure: preflightResult,
      ok: false,
    };
  }

  const reviewPlanResult = await loadPreWriteReviewPlanForContext(
    preflightResult.preflight,
    dependencies,
  );

  if (!reviewPlanResult.ok) {
    return {
      failure: createOnboardFailure(reviewPlanResult.failure.code, {
        details: {
          path: reviewPlanResult.failure.path,
        },
        message: reviewPlanResult.failure.message,
      }),
      ok: false,
    };
  }

  const blockingFailure = createPreWriteBlockingFailure(
    reviewPlanResult.result.plan.blockingFindings[0],
  );

  if (blockingFailure !== undefined) {
    return {
      failure: blockingFailure,
      ok: false,
    };
  }

  const apiKeyResult = await promptForValidatedApiKey(dependencies);

  if (!apiKeyResult.ok) {
    return apiKeyResult;
  }

  const catalogResult = await fetchGonkaGateLiveCatalog(
    apiKeyResult.result.apiKey,
    dependencies,
  );

  if (!catalogResult.ok) {
    return catalogResult;
  }

  const qualifiedLiveModelsResult = await loadQualifiedLiveModels(
    catalogResult.catalog,
    dependencies,
    {
      artifactsRoot: phaseThreeOptions.qualificationArtifactsRoot,
    },
  );

  if (!qualifiedLiveModelsResult.ok) {
    return qualifiedLiveModelsResult;
  }

  const selectionResult = await selectQualifiedModel(
    qualifiedLiveModelsResult.result.qualifiedLiveModels,
    dependencies,
  );

  if (!selectionResult.ok) {
    return selectionResult;
  }

  return {
    ok: true,
    result: {
      apiKey: apiKeyResult.result.apiKey,
      catalog: catalogResult.catalog,
      catalogResult,
      preflight: preflightResult.preflight,
      qualifiedLiveModels: qualifiedLiveModelsResult.result.qualifiedLiveModels,
      reviewPlan: reviewPlanResult.result,
      selectedModel: selectionResult.result,
    },
  };
}
