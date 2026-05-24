import type {
  MatchingProviderConflict,
  MatchingProviderMatch,
} from "../../domain/conflicts.js";
import type { NormalizedHermesRead } from "../normalized-read.js";

export function classifyMatchingProviders(
  read: NormalizedHermesRead,
): MatchingProviderConflict {
  const matchingEntries = read.namedCustomProviders
    .filter((entry) => entry.canonicalUrlFieldKeys.length > 0)
    .map<MatchingProviderMatch>((entry) => ({
      entry,
    }));

  if (matchingEntries.length === 0) {
    return {
      kind: "matching_provider",
      matchingEntries: [],
      status: "none",
    };
  }

  if (matchingEntries.length > 1) {
    return {
      kind: "matching_provider",
      matchingEntries,
      reason: "multiple_matching_entries",
      status: "blocking",
    };
  }

  const [singleMatch] = matchingEntries;

  if (singleMatch === undefined) {
    return {
      kind: "matching_provider",
      matchingEntries: [],
      status: "none",
    };
  }

  if (singleMatch.entry.sourceShape === "custom_providers") {
    return {
      kind: "matching_provider",
      matchingEntries,
      reason: "legacy_custom_provider_entry",
      status: "blocking",
    };
  }

  if (!hasCompetingProviderSelectors(singleMatch.entry)) {
    return {
      kind: "matching_provider",
      matchingEntries,
      status: "compatible",
    };
  }

  return {
    kind: "matching_provider",
    matchingEntries,
    reason: "competing_provider_selectors",
    status: "blocking",
  };
}

function hasCompetingProviderSelectors(
  entry: NormalizedHermesRead["namedCustomProviders"][number],
): boolean {
  return (
    entry.apiKey.length > 0 ||
    entry.rawEntry.api_key_env !== undefined ||
    entry.rawEntry.key_env !== undefined ||
    (entry.apiMode.length > 0 && entry.apiMode !== "chat_completions") ||
    (entry.transport.length > 0 && entry.transport !== "openai_chat") ||
    entry.nonCanonicalUrlFieldKeys.length > 0
  );
}
