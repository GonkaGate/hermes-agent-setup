import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  AuthPoolConflict,
  PreWriteReviewBlockingFinding,
  SharedOpenAiKeyConflict,
} from "../domain/conflicts.js";

export function createPreWriteBlockingFailure(
  blockingFinding: PreWriteReviewBlockingFinding | undefined,
): OnboardFailure | undefined {
  if (blockingFinding === undefined) {
    return undefined;
  }

  switch (blockingFinding.kind) {
    case "auth_pool":
      if (blockingFinding.status !== "blocking") {
        return undefined;
      }

      return createAuthPoolFailure(blockingFinding);
    case "matching_provider":
      return createOnboardFailure("provider_conflict", {
        details: {
          matchingEntries: blockingFinding.matchingEntries.map(
            (entry) => entry.entry.name,
          ),
          reason: blockingFinding.reason,
        },
        guidance:
          "Remove or repair the matching GonkaGate custom-provider entries in Hermes config.yaml, then rerun the helper.",
        message:
          "A Hermes custom-provider entry still targets the canonical GonkaGate URL outside the helper-managed model config.",
      });
    case "shared_openai_key":
      return createSharedKeyFailure(blockingFinding);
    default:
      return undefined;
  }
}

function createAuthPoolFailure(
  conflict: Extract<AuthPoolConflict, { status: "blocking" }>,
): OnboardFailure {
  return createOnboardFailure("auth_pool_conflict", {
    details: {
      credentialCount: conflict.credentialCount,
      matchingProviderName: conflict.matchingProviderName,
      poolKey: conflict.poolKey,
    },
    guidance:
      "Resolve the matching Hermes auth pool manually with Hermes-owned auth commands such as `hermes auth list` and `hermes auth remove`, then rerun the helper.",
    message:
      "A matching Hermes custom credential pool still contains competing credentials for the canonical GonkaGate URL.",
  });
}

function createSharedKeyFailure(
  conflict: SharedOpenAiKeyConflict,
): OnboardFailure {
  return createOnboardFailure("shared_api_key_conflict", {
    details: {
      location: conflict.location,
      reason: conflict.reason,
      surfaceId: conflict.surfaceId,
    },
    guidance:
      "Resolve the ambiguous shared OPENAI_API_KEY surface in Hermes config before rerunning the helper.",
    message:
      "The helper found a blocking shared OPENAI_API_KEY surface that it cannot take over safely in v1.",
  });
}
