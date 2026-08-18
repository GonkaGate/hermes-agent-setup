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

  // The live catalog owns model order, so the first returned model is the
  // default. The helper never ranks, sorts, or prefers models itself.
  const defaultModel = liveModels[0];

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

  const selectedModelId = await dependencies.prompts.selectOption({
    choices: liveModels.map((model) => createModelChoice(model, defaultModel)),
    defaultValue: defaultModel.modelId,
    message: "Choose the GonkaGate model to configure for Hermes Agent",
    pageSize: Math.min(8, liveModels.length),
  });
  const selectedModel = liveModels.find(
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
  defaultModel: QualifiedLiveModel,
): {
  description: string;
  label: string;
  value: string;
} {
  const isDefault = model.modelId === defaultModel.modelId;
  const label =
    model.displayName === undefined || model.displayName === model.modelId
      ? model.modelId
      : `${model.displayName} (${model.modelId})`;

  return {
    description: createModelDescription(model, isDefault),
    label: isDefault ? `${label} (Default)` : label,
    value: model.modelId,
  };
}

/**
 * Builds the picker description from live catalog metadata when the gateway
 * provides it, and from the previous generic wording when it does not.
 */
function createModelDescription(
  model: QualifiedLiveModel,
  isDefault: boolean,
): string {
  const descriptionParts = [
    model.description ??
      (isDefault ? "Live catalog default" : "Live GonkaGate model"),
  ];

  if (model.contextLength !== undefined) {
    descriptionParts.push(
      `${formatContextLength(model.contextLength)} token context`,
    );
  }

  return descriptionParts.join(" - ");
}

function formatContextLength(contextLength: number): string {
  return new Intl.NumberFormat("en-US").format(contextLength);
}

function createQualifiedModelsUnavailableFailure(): OnboardFailure {
  return createOnboardFailure("qualified_models_unavailable", {
    guidance:
      "Check the live GonkaGate /v1/models catalog, then rerun the helper.",
    message:
      "The helper could not present a live GonkaGate model choice before any Hermes files were changed.",
  });
}
