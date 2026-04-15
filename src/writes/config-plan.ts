import YAML from "yaml";
import { CANONICAL_BASE_URL } from "../constants/contract.js";
import type { PlannedConfigScrub } from "../domain/conflicts.js";
import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  ConfigMutationAction,
  ConfigMutationPlan,
} from "../domain/writes.js";
import type { NormalizedHermesRead } from "../hermes/normalized-read.js";
import { isRecord } from "../hermes/provider-utils.js";

export interface BuildConfigMutationPlanInput {
  plannedConfigScrubs: readonly PlannedConfigScrub[];
  read: NormalizedHermesRead;
  selectedModelId: string;
}

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

  actions.push(
    ...planManagedModelField(
      modelRoot,
      ["model", "provider"],
      "model.provider",
      "custom",
    ),
    ...planManagedModelField(
      modelRoot,
      ["model", "base_url"],
      "model.base_url",
      CANONICAL_BASE_URL,
    ),
    ...planManagedModelField(
      modelRoot,
      ["model", "default"],
      "model.default",
      input.selectedModelId,
    ),
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
  pathSegments: readonly ["model", "provider" | "base_url" | "default"],
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
