import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import type {
  QualifiedLiveModel,
  QualifiedModelArtifact,
} from "../gonkagate/qualified-models.js";
import { canUseInteractivePrompts } from "./prompts.js";

export interface SelectedQualifiedModel {
  model: QualifiedLiveModel;
  selectionSource: "auto_single_option" | "interactive";
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
  const sortedModels = [...qualifiedLiveModels].sort((left, right) =>
    left.modelId.localeCompare(right.modelId),
  );

  if (sortedModels.length === 0) {
    return {
      failure: createQualifiedModelsUnavailableFailure(),
      ok: false,
    };
  }

  if (sortedModels.length === 1) {
    const [singleModel] = sortedModels;

    if (singleModel === undefined) {
      return {
        failure: createQualifiedModelsUnavailableFailure(),
        ok: false,
      };
    }

    return {
      ok: true,
      result: {
        model: singleModel,
        selectionSource: "auto_single_option",
      },
    };
  }

  if (!canUseInteractivePrompts(dependencies)) {
    return {
      failure: createOnboardFailure("missing_tty", {
        guidance:
          "Run the helper in an interactive terminal before choosing a qualified GonkaGate model.",
        message:
          "A TTY is required to choose between multiple qualified GonkaGate models.",
      }),
      ok: false,
    };
  }

  const recommendedModel =
    sortedModels.find((model) => model.recommended) ?? sortedModels[0];

  if (recommendedModel === undefined) {
    return {
      failure: createQualifiedModelsUnavailableFailure(),
      ok: false,
    };
  }

  const selectedModelId = await dependencies.prompts.selectOption({
    choices: sortedModels.map((model) =>
      createModelChoice(model, recommendedModel),
    ),
    defaultValue: recommendedModel.modelId,
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
  model: QualifiedModelArtifact,
  recommendedModel: QualifiedModelArtifact,
): {
  description: string;
  label: string;
  value: string;
} {
  return {
    description: [
      `Qualified on ${model.qualifiedOn}`,
      `Hermes ${model.hermesReleaseTag}`,
    ].join(" · "),
    label:
      model.modelId === recommendedModel.modelId
        ? `${model.modelId} (Recommended)`
        : model.modelId,
    value: model.modelId,
  };
}

function createQualifiedModelsUnavailableFailure(): OnboardFailure {
  return createOnboardFailure("qualified_models_unavailable", {
    guidance:
      "Check the checked-in qualification artifacts and the live GonkaGate catalog, then rerun the helper.",
    message:
      "The helper could not present a qualified live GonkaGate model choice before any Hermes files were changed.",
  });
}
