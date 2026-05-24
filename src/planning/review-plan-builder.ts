import type {
  MatchingProviderConflict,
  PlannedConfigScrub,
  PreWriteReviewPlan,
} from "../domain/conflicts.js";
import { classifyAuthPoolConflict } from "../hermes/conflicts/auth-pools.js";
import { classifyMatchingProviders } from "../hermes/conflicts/matching-providers.js";
import { classifySharedOpenAiKeyConflicts } from "../hermes/conflicts/shared-openai-key.js";
import type {
  LoadNormalizedHermesReadResult,
  NormalizedHermesRead,
} from "../hermes/normalized-read.js";
import { loadNormalizedHermesRead } from "../hermes/normalized-read.js";
import type { ResolvedHermesContext } from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export interface BuildPreWriteReviewPlanResult {
  authPoolConflict: ReturnType<typeof classifyAuthPoolConflict>;
  matchingProviderConflict: MatchingProviderConflict;
  plan: PreWriteReviewPlan;
  read: NormalizedHermesRead;
  sharedOpenAiKeyConflicts: ReturnType<typeof classifySharedOpenAiKeyConflicts>;
}

export type LoadPreWriteReviewPlanForContextResult =
  | {
      ok: true;
      result: BuildPreWriteReviewPlanResult;
    }
  | Extract<LoadNormalizedHermesReadResult, { ok: false }>;

export async function loadPreWriteReviewPlanForContext(
  context: ResolvedHermesContext,
  dependencies: OnboardDependencies,
): Promise<LoadPreWriteReviewPlanForContextResult> {
  const readResult = await loadNormalizedHermesRead(context, dependencies);

  if (!readResult.ok) {
    return readResult;
  }

  return {
    ok: true,
    result: buildPreWriteReviewPlan(readResult.read),
  };
}

export function buildPreWriteReviewPlan(
  read: NormalizedHermesRead,
): BuildPreWriteReviewPlanResult {
  const sharedOpenAiKeyConflicts = classifySharedOpenAiKeyConflicts(read);
  const matchingProviderConflict = classifyMatchingProviders(read);
  const authPoolConflict = classifyAuthPoolConflict(
    read,
    matchingProviderConflict,
  );

  const plannedConfigScrubs = [...collectModelScrubs(read)];
  const blockingFindings = [
    ...sharedOpenAiKeyConflicts.filter(
      (conflict) => conflict.status === "blocking",
    ),
    ...(matchingProviderConflict.status === "blocking"
      ? [matchingProviderConflict]
      : []),
    ...(authPoolConflict.status === "blocking" ? [authPoolConflict] : []),
  ];
  const confirmationItems = [
    ...(sharedOpenAiKeyConflicts.some(
      (conflict) => conflict.status === "confirmation_required",
    )
      ? [
          {
            conflicts: sharedOpenAiKeyConflicts.filter(
              (conflict) => conflict.status === "confirmation_required",
            ),
            kind: "shared_openai_key_takeover" as const,
          },
        ]
      : []),
  ];

  return {
    authPoolConflict,
    matchingProviderConflict,
    plan: {
      blockingFindings,
      confirmationItems,
      plannedConfigScrubs,
    },
    read,
    sharedOpenAiKeyConflicts,
  };
}

function collectModelScrubs(
  read: NormalizedHermesRead,
): readonly PlannedConfigScrub[] {
  const scrubs: PlannedConfigScrub[] = [];
  const model = read.config.model;

  if (model.apiKey.length > 0) {
    scrubs.push({
      fieldPath: "model.api_key",
      pathSegments: ["model", "api_key"],
      reason:
        "Clear model.api_key so the GonkaGate secret lives only in ~/.hermes/.env.",
      target: "model",
    });
  }

  if (model.api.length > 0) {
    scrubs.push({
      fieldPath: "model.api",
      pathSegments: ["model", "api"],
      reason:
        "Clear model.api because the helper-owned main endpoint is model.base_url.",
      target: "model",
    });
  }

  if (model.apiMode.length > 0 && model.apiMode !== "chat_completions") {
    scrubs.push({
      fieldPath: "model.api_mode",
      pathSegments: ["model", "api_mode"],
      reason:
        "Clear incompatible model.api_mode so Hermes uses the helper-managed chat-completions path.",
      target: "model",
    });
  }

  return scrubs;
}
