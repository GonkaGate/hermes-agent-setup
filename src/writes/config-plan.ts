import YAML from "yaml";
import {
  CANONICAL_BASE_URL,
  GONKAGATE_API_KEY_ENV_VAR,
  GONKAGATE_PROVIDER_NAME,
  GONKAGATE_PROVIDER_SELECTOR,
} from "../constants/contract.js";
import type { PlannedConfigScrub } from "../domain/conflicts.js";
import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  ConfigMutationAction,
  ConfigMutationPlan,
} from "../domain/writes.js";
import type { QualifiedLiveModel } from "../gonkagate/qualified-models.js";
import type { NormalizedHermesRead } from "../hermes/normalized-read.js";
import { isRecord, normalizeProviderName } from "../hermes/provider-utils.js";

export interface BuildConfigMutationPlanInput {
  plannedConfigScrubs: readonly PlannedConfigScrub[];
  qualifiedLiveModels: readonly QualifiedLiveModel[];
  read: NormalizedHermesRead;
  selectedModelId: string;
}

const MANAGED_PROVIDER_API_MODE = "chat_completions";
const MANAGED_PROVIDER_REMOVED_FIELDS = [
  "api",
  "url",
  "api_key",
  "api_key_env",
  "transport",
] as const;

export function buildConfigMutationPlan(input: BuildConfigMutationPlanInput):
  | {
      ok: true;
      result: ConfigMutationPlan;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    } {
  const currentRootResult = loadEditableConfigRoot(input.read);

  if (!currentRootResult.ok) {
    return currentRootResult;
  }

  const currentRoot = currentRootResult.root;
  const nextRoot = structuredClone(currentRoot);
  const actions: ConfigMutationAction[] = [];
  const modelRoot = ensureMapping(nextRoot, ["model"]);
  const qualifiedModelIds = getQualifiedModelIds(input);

  actions.push(
    ...planManagedCustomProvider(nextRoot, qualifiedModelIds),
    ...planManagedModelField(
      modelRoot,
      ["model", "provider"],
      "model.provider",
      GONKAGATE_PROVIDER_SELECTOR,
    ),
    ...planManagedModelField(
      modelRoot,
      ["model", "default"],
      "model.default",
      input.selectedModelId,
    ),
    ...planDeletedModelField(modelRoot, "base_url"),
    ...planDeletedModelField(modelRoot, "api_key"),
  );

  for (const scrub of input.plannedConfigScrubs) {
    if (deletePathValue(nextRoot, scrub.pathSegments)) {
      actions.push({
        fieldPath: scrub.fieldPath,
        kind: "delete",
        pathSegments: scrub.pathSegments,
      });
    }
  }

  const existedBefore = input.read.raw.config.status === "ok";
  const changed = actions.length > 0;

  return {
    ok: true,
    result: {
      actions: Object.freeze(actions),
      changed,
      existedBefore,
      nextContents: changed
        ? YAML.stringify(nextRoot)
        : getUnchangedConfigContents(input.read),
      path: input.read.context.configPath,
      target: "config",
    },
  };
}

function loadEditableConfigRoot(read: NormalizedHermesRead):
  | {
      ok: true;
      root: Record<string, unknown>;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    } {
  if (read.raw.config.status === "missing") {
    return {
      ok: true,
      root: {},
    };
  }

  if (read.raw.config.status !== "ok") {
    return {
      failure: createOnboardFailure("config_parse_failed", {
        details: {
          path: read.context.configPath,
        },
        message: "The helper could not prepare a writable Hermes config plan.",
      }),
      ok: false,
    };
  }

  const document = YAML.parseDocument(read.raw.config.rawText);

  if (document.errors.length > 0) {
    return {
      failure: createOnboardFailure("config_parse_failed", {
        details: {
          path: read.context.configPath,
        },
        message:
          document.errors[0]?.message ??
          "The helper could not parse Hermes config.yaml into a writable document.",
      }),
      ok: false,
    };
  }

  const parsedValue = document.toJS();

  if (parsedValue === null || parsedValue === undefined) {
    return {
      ok: true,
      root: {},
    };
  }

  if (!isRecord(parsedValue)) {
    return {
      failure: createOnboardFailure("config_parse_failed", {
        details: {
          path: read.context.configPath,
        },
        message: "Hermes config.yaml must remain a mapping at the root.",
      }),
      ok: false,
    };
  }

  return {
    ok: true,
    root: parsedValue,
  };
}

function planManagedModelField(
  modelRoot: Record<string, unknown>,
  pathSegments: readonly ["model", "provider" | "default"],
  fieldPath: string,
  nextValue: string,
): readonly ConfigMutationAction[] {
  const key = pathSegments[1];
  const currentValue = typeof modelRoot[key] === "string" ? modelRoot[key] : "";

  if (currentValue === nextValue) {
    return [];
  }

  modelRoot[key] = nextValue;

  return [
    {
      fieldPath,
      kind: "set",
      nextValueDisplay: nextValue,
      pathSegments,
    },
  ];
}

function planManagedCustomProvider(
  root: Record<string, unknown>,
  modelIds: readonly string[],
): readonly ConfigMutationAction[] {
  const currentValue = root.custom_providers;
  const providers = normalizeEditableCustomProviders(currentValue);
  const existingIndex = providers.findIndex(
    (provider) =>
      normalizeProviderName(readProviderName(provider)) ===
      GONKAGATE_PROVIDER_NAME,
  );
  const managedIndex = existingIndex === -1 ? providers.length : existingIndex;
  const existingEntry = existingIndex === -1 ? {} : providers[existingIndex];
  const actions: ConfigMutationAction[] = [];

  if (currentValue !== undefined && !Array.isArray(currentValue)) {
    actions.push({
      fieldPath: "custom_providers",
      kind: "set",
      nextValueDisplay: "array",
      pathSegments: ["custom_providers"],
    });
  }

  if (existingIndex === -1) {
    actions.push({
      fieldPath: "custom_providers[name=gonkagate]",
      kind: "set",
      nextValueDisplay: "managed GonkaGate provider",
      pathSegments: ["custom_providers", managedIndex],
    });
  }

  if (!isRecord(existingEntry)) {
    providers[managedIndex] = createManagedProviderEntry({}, modelIds);
    root.custom_providers = providers;
    return actions;
  }

  const nextEntry = createManagedProviderEntry(existingEntry, modelIds);

  actions.push(
    ...planManagedProviderField(
      existingEntry,
      managedIndex,
      "base_url",
      CANONICAL_BASE_URL,
    ),
    ...planManagedProviderField(
      existingEntry,
      managedIndex,
      "key_env",
      GONKAGATE_API_KEY_ENV_VAR,
    ),
    ...planManagedProviderField(
      existingEntry,
      managedIndex,
      "api_mode",
      MANAGED_PROVIDER_API_MODE,
    ),
    ...planManagedProviderModels(existingEntry, managedIndex, modelIds),
    ...planRemovedManagedProviderFields(existingEntry, managedIndex),
  );

  providers[managedIndex] = nextEntry;
  root.custom_providers = providers;
  return actions;
}

function normalizeEditableCustomProviders(
  value: unknown,
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({ ...entry }));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    )
    .map(([name, entry]) => ({
      name: typeof entry.name === "string" ? entry.name : name,
      ...entry,
    }));
}

function createManagedProviderEntry(
  existingEntry: Record<string, unknown>,
  modelIds: readonly string[],
): Record<string, unknown> {
  const nextEntry = { ...existingEntry };

  for (const key of MANAGED_PROVIDER_REMOVED_FIELDS) {
    delete nextEntry[key];
  }

  return {
    ...nextEntry,
    api_mode: MANAGED_PROVIDER_API_MODE,
    base_url: CANONICAL_BASE_URL,
    key_env: GONKAGATE_API_KEY_ENV_VAR,
    models: Object.fromEntries(modelIds.map((modelId) => [modelId, {}])),
    name: GONKAGATE_PROVIDER_NAME,
  };
}

function planManagedProviderField(
  existingEntry: Record<string, unknown>,
  providerIndex: number,
  key: "api_mode" | "base_url" | "key_env",
  nextValue: string,
): readonly ConfigMutationAction[] {
  const currentValue =
    typeof existingEntry[key] === "string" ? existingEntry[key] : "";

  if (currentValue === nextValue) {
    return [];
  }

  return [
    {
      fieldPath: `custom_providers[name=gonkagate].${key}`,
      kind: "set",
      nextValueDisplay: nextValue,
      pathSegments: ["custom_providers", providerIndex, key],
    },
  ];
}

function planManagedProviderModels(
  existingEntry: Record<string, unknown>,
  providerIndex: number,
  modelIds: readonly string[],
): readonly ConfigMutationAction[] {
  const existingModels = isRecord(existingEntry.models)
    ? Object.keys(existingEntry.models).sort()
    : [];

  if (arraysEqual(existingModels, [...modelIds])) {
    return [];
  }

  return [
    {
      fieldPath: "custom_providers[name=gonkagate].models",
      kind: "set",
      nextValueDisplay: modelIds.join(", "),
      pathSegments: ["custom_providers", providerIndex, "models"],
    },
  ];
}

function planRemovedManagedProviderFields(
  existingEntry: Record<string, unknown>,
  providerIndex: number,
): readonly ConfigMutationAction[] {
  return MANAGED_PROVIDER_REMOVED_FIELDS.filter(
    (key) => key in existingEntry,
  ).map((key) => ({
    fieldPath: `custom_providers[name=gonkagate].${key}`,
    kind: "delete",
    pathSegments: ["custom_providers", providerIndex, key],
  }));
}

function planDeletedModelField(
  modelRoot: Record<string, unknown>,
  key: "api_key" | "base_url",
): readonly ConfigMutationAction[] {
  if (!(key in modelRoot)) {
    return [];
  }

  delete modelRoot[key];

  return [
    {
      fieldPath: `model.${key}`,
      kind: "delete",
      pathSegments: ["model", key],
    },
  ];
}

function getQualifiedModelIds(
  input: Pick<
    BuildConfigMutationPlanInput,
    "qualifiedLiveModels" | "selectedModelId"
  >,
): readonly string[] {
  const modelIds = new Set<string>();

  for (const model of input.qualifiedLiveModels) {
    modelIds.add(model.modelId);
  }

  modelIds.add(input.selectedModelId);

  return Object.freeze(
    [...modelIds].sort((left, right) => left.localeCompare(right)),
  );
}

function readProviderName(entry: Record<string, unknown>): string {
  return typeof entry.name === "string" ? entry.name : "";
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function ensureMapping(
  root: Record<string, unknown>,
  path: readonly string[],
): Record<string, unknown> {
  let current: Record<string, unknown> = root;

  for (const segment of path) {
    const existingValue = current[segment];

    if (isRecord(existingValue)) {
      current = existingValue;
      continue;
    }

    const nextValue: Record<string, unknown> = {};
    current[segment] = nextValue;
    current = nextValue;
  }

  return current;
}

function deletePathValue(
  root: Record<string, unknown>,
  path: readonly (string | number)[],
): boolean {
  if (path.length === 0) {
    return false;
  }

  let current: unknown = root;

  for (const segment of path.slice(0, -1)) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || current[segment] === undefined) {
        return false;
      }

      current = current[segment];
      continue;
    }

    if (!isRecord(current) || !(segment in current)) {
      return false;
    }

    current = current[segment];
  }

  const finalSegment = path[path.length - 1];

  if (typeof finalSegment === "number") {
    if (!Array.isArray(current) || current[finalSegment] === undefined) {
      return false;
    }

    current.splice(finalSegment, 1);
    return true;
  }

  if (!isRecord(current) || !(finalSegment in current)) {
    return false;
  }

  delete current[finalSegment];
  return true;
}

function getUnchangedConfigContents(read: NormalizedHermesRead): string {
  return read.raw.config.status === "ok" ? read.raw.config.rawText : "";
}
