import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { QualifiedLiveModel } from "../gonkagate/qualified-models.js";
import { canUseInteractivePrompts } from "./prompts.js";

export interface SelectedQualifiedModel {
  model: QualifiedLiveModel;
  selectionSource: "auto_default" | "auto_single_option" | "interactive";
}

export async function selectQualifiedModel(
  qualifiedLiveModels: readonly QualifiedLiveModel[],
  dependencies: OnboardDependencies,
): Promise<
  | {
      ok: true;
      result: SelectedQualifiedModel;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  const liveModels = [...qualifiedLiveModels];

  if (liveModels.length === 0) {
    return {
      failure: createQualifiedModelsUnavailableFailure(),
      ok: false,
    };
  }

  const defaultModel =
    liveModels.find((model) => model.recommended) ?? liveModels[0];

  if (defaultModel === undefined) {
    return {
      failure: createQualifiedModelsUnavailableFailure(),
      ok: false,
    };
  }

  if (liveModels.length === 1 || !canUseInteractivePrompts(dependencies)) {
    const selectionSource =
      liveModels.length === 1 ? "auto_single_option" : "auto_default";

    return {
      ok: true,
      result: {
        model: defaultModel,
        selectionSource,
      },
    };
  }
  const sortedModels = [...liveModels].sort((left, right) =>
    left.modelId.localeCompare(right.modelId),
  );

  const selectedModelId = await dependencies.prompts.selectOption({
    choices: sortedModels.map((model) =>
      createModelChoice(model, defaultModel),
    ),
    defaultValue: defaultModel.modelId,
    message: "Choose the GonkaGate model to configure for Hermes Agent",
    pageSize: Math.min(8, sortedModels.length),
  });
  const selectedModel = sortedModels.find(
    (model) => model.modelId === selectedModelId,
  );

  if (selectedModel === undefined) {
    return {
      failure: createQualifiedModelsUnavailableFailure(),
      ok: false,
    };
  }

  return {
    ok: true,
    result: {
      model: selectedModel,
      selectionSource: "interactive",
    },
  };
}

function createModelChoice(
  model: QualifiedLiveModel,
  recommendedModel: QualifiedLiveModel,
): {
  description: string;
  label: string;
  value: string;
} {
  const label =
    model.displayName === undefined || model.displayName === model.modelId
      ? model.modelId
      : `${model.displayName} (${model.modelId})`;

  return {
    description:
      model.modelId === recommendedModel.modelId
        ? "Live catalog default"
        : "Live GonkaGate model",
    label:
      model.modelId === recommendedModel.modelId ? `${label} (Default)` : label,
    value: model.modelId,
  };
}

function createQualifiedModelsUnavailableFailure(): OnboardFailure {
  return createOnboardFailure("qualified_models_unavailable", {
    guidance:
      "Check the live GonkaGate /v1/models catalog, then rerun the helper.",
    message:
      "The helper could not present a live GonkaGate model choice before any Hermes files were changed.",
  });
}
