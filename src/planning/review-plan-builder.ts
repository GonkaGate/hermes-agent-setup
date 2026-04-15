import type {
  MatchingProviderConflict,
  PlannedConfigScrub,
  PlannedEnvCleanup,
  PreWriteReviewPlan,
} from "../domain/conflicts.js";
import { classifyAuthPoolConflict } from "../hermes/conflicts/auth-pools.js";
import { classifyMatchingProviders } from "../hermes/conflicts/matching-providers.js";
import { classifyOpenAiBaseUrlConflicts } from "../hermes/conflicts/openai-base-url.js";
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
  openAiBaseUrlConflicts: ReturnType<typeof classifyOpenAiBaseUrlConflicts>;
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
  const openAiBaseUrlConflicts = classifyOpenAiBaseUrlConflicts(read);
  const matchingProviderConflict = classifyMatchingProviders(read);
  const authPoolConflict = classifyAuthPoolConflict(
    read,
    matchingProviderConflict,
  );

  const plannedConfigScrubs = [
    ...collectModelScrubs(read),
    ...collectMatchingProviderScrubs(matchingProviderConflict),
  ];
  const plannedEnvCleanup = collectEnvCleanup(openAiBaseUrlConflicts);
  const blockingFindings = [
    ...sharedOpenAiKeyConflicts.filter(
      (conflict) => conflict.status === "blocking",
    ),
    ...openAiBaseUrlConflicts.filter(
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
    ...openAiBaseUrlConflicts
      .filter((conflict) => conflict.status === "confirmation_required")
      .map((conflict) => ({
        conflict,
        kind: "file_openai_base_url_cleanup" as const,
      })),
    ...(matchingProviderConflict.status === "scrubbable"
      ? [
          {
            conflict: matchingProviderConflict,
            kind: "matching_provider_scrub" as const,
          },
        ]
      : []),
  ];

  return {
    authPoolConflict,
    matchingProviderConflict,
    openAiBaseUrlConflicts,
    plan: {
      advisories: openAiBaseUrlConflicts.filter(
        (conflict) => conflict.status === "advisory",
      ),
      blockingFindings,
      confirmationItems,
      plannedConfigScrubs,
      plannedEnvCleanup,
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

function collectMatchingProviderScrubs(
  conflict: MatchingProviderConflict,
): readonly PlannedConfigScrub[] {
  if (conflict.status !== "scrubbable") {
    return [];
  }

  const [match] = conflict.matchingEntries;

  if (match === undefined) {
    return [];
  }

  const scrubs: PlannedConfigScrub[] = [];
  const { entry } = match;

  if (entry.apiKey.length > 0) {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, "api_key"],
        entry.name,
        `${entry.path}.api_key`,
        "Clear competing inline API key.",
      ),
    );
  }

  if (entry.rawEntry.api_key_env !== undefined) {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, "api_key_env"],
        entry.name,
        `${entry.path}.api_key_env`,
        "Clear competing provider-specific secret binding.",
      ),
    );
  }

  if (entry.rawEntry.key_env !== undefined) {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, "key_env"],
        entry.name,
        `${entry.path}.key_env`,
        "Clear competing provider-specific secret binding.",
      ),
    );
  }

  if (entry.apiMode.length > 0 && entry.apiMode !== "chat_completions") {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, "api_mode"],
        entry.name,
        `${entry.path}.api_mode`,
        "Clear incompatible provider api_mode.",
      ),
    );
  }

  if (entry.transport.length > 0 && entry.transport !== "openai_chat") {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, "transport"],
        entry.name,
        `${entry.path}.transport`,
        "Clear incompatible provider transport.",
      ),
    );
  }

  for (const fieldKey of entry.nonCanonicalUrlFieldKeys) {
    scrubs.push(
      createProviderScrub(
        [...entry.pathSegments, fieldKey],
        entry.name,
        `${entry.path}.${fieldKey}`,
        "Clear duplicate non-canonical URL alias.",
      ),
    );
  }

  return scrubs;
}

function createProviderScrub(
  pathSegments: readonly (string | number)[],
  providerName: string,
  fieldPath: string,
  reason: string,
): PlannedConfigScrub {
  return {
    fieldPath,
    pathSegments,
    providerName,
    reason,
    target: "named_provider",
  };
}

function collectEnvCleanup(
  conflicts: ReturnType<typeof classifyOpenAiBaseUrlConflicts>,
): readonly PlannedEnvCleanup[] {
  return conflicts
    .filter(
      (conflict) =>
        conflict.source === "file" &&
        (conflict.status === "planned_cleanup" ||
          conflict.status === "confirmation_required"),
    )
    .map((conflict) => ({
      confirmationRequired: conflict.status === "confirmation_required",
      existingValue: conflict.value,
      key: "OPENAI_BASE_URL",
      reason:
        conflict.status === "planned_cleanup"
          ? "Clear canonical OPENAI_BASE_URL residue so config.yaml is the saved source of truth."
          : "Clear conflicting OPENAI_BASE_URL before helper-managed onboarding can be deterministic.",
      source: "file",
    }));
}
