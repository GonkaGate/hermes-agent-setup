import type {
  MatchingProviderConflict,
  MatchingProviderMatch,
} from "../../domain/conflicts.js";
import { GONKAGATE_PROVIDER_NAME } from "../../constants/contract.js";
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

  if (
    singleMatch.entry.sourceShape !== "custom_providers" ||
    singleMatch.entry.normalizedName !== GONKAGATE_PROVIDER_NAME
  ) {
    return {
      kind: "matching_provider",
      matchingEntries,
      reason: "non_managed_matching_entry",
      status: "blocking",
    };
  }

  return {
    kind: "matching_provider",
    matchingEntries,
    status: "compatible",
  };
}
