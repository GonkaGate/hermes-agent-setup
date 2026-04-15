import type { PlannedEnvCleanup } from "../domain/conflicts.js";
import type { EnvMutationAction, EnvMutationPlan } from "../domain/writes.js";
import type { NormalizedHermesRead } from "../hermes/normalized-read.js";
import type { ValidatedApiKey } from "../validation/api-key.js";

export interface BuildEnvMutationPlanInput {
  apiKey: ValidatedApiKey;
  plannedEnvCleanup: readonly PlannedEnvCleanup[];
  read: NormalizedHermesRead;
}

export function buildEnvMutationPlan(
  input: BuildEnvMutationPlanInput,
): EnvMutationPlan {
  const rawEnv = input.read.raw.env;
  const currentValues =
    rawEnv.status === "ok"
      ? { ...rawEnv.data.values }
      : ({} as Record<string, string>);
  const orderedKeys =
    rawEnv.status === "ok" ? [...rawEnv.data.orderedKeys] : ([] as string[]);
  const actions: EnvMutationAction[] = [];
  const nextApiKey = input.apiKey;

  if (currentValues.OPENAI_API_KEY !== nextApiKey) {
    actions.push({
      key: "OPENAI_API_KEY",
      kind: "set",
      nextValueDisplay: "[hidden GonkaGate API key]",
      sensitive: true,
    });
    currentValues.OPENAI_API_KEY = nextApiKey;
  }

  if (!orderedKeys.includes("OPENAI_API_KEY")) {
    orderedKeys.push("OPENAI_API_KEY");
  }

  for (const cleanup of input.plannedEnvCleanup) {
    if (!(cleanup.key in currentValues)) {
      continue;
    }

    delete currentValues[cleanup.key];
    actions.push({
      key: cleanup.key,
      kind: "delete",
    });
  }

  const nextOrderedKeys = orderedKeys.filter((key) => key in currentValues);
  const changed = actions.length > 0;

  return {
    actions: Object.freeze(actions),
    changed,
    existedBefore: rawEnv.status === "ok",
    nextContents: changed
      ? serializeEnvFile(nextOrderedKeys, currentValues)
      : getUnchangedEnvContents(input.read),
    orderedKeys: Object.freeze(nextOrderedKeys),
    path: input.read.context.envPath,
    target: "env",
  };
}

function serializeEnvFile(
  orderedKeys: readonly string[],
  values: Readonly<Record<string, string>>,
): string {
  if (orderedKeys.length === 0) {
    return "";
  }

  return `${orderedKeys.map((key) => `${key}=${values[key] ?? ""}`).join("\n")}\n`;
}

function getUnchangedEnvContents(read: NormalizedHermesRead): string {
  return read.raw.env.status === "ok" ? read.raw.env.rawText : "";
}
