import type { CatalogClientResult, LiveGonkaGateCatalog } from "./catalog.js";
import type { BuildPreWriteReviewPlanResult } from "../planning/review-plan-builder.js";
import type { PreflightReport, OnboardFailure } from "./runtime.js";
import type { QualifiedLiveModel } from "../gonkagate/qualified-models.js";
import type { SelectedQualifiedModel } from "../ui/model-picker.js";
import type { ValidatedApiKey } from "../validation/api-key.js";

export interface PhaseThreeSelectionReady {
  apiKey: ValidatedApiKey;
  catalog: LiveGonkaGateCatalog;
  catalogResult: Extract<CatalogClientResult, { ok: true }>;
  preflight: PreflightReport;
  qualifiedLiveModels: readonly QualifiedLiveModel[];
  reviewPlan: BuildPreWriteReviewPlanResult;
  selectedModel: SelectedQualifiedModel;
}

export type PhaseThreeSelectionResult =
  | {
      ok: true;
      result: PhaseThreeSelectionReady;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    };
