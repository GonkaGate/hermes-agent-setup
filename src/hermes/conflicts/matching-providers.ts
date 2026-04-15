import type {
  MatchingProviderConflict,
  MatchingProviderMatch,
  MatchingProviderScrubField,
} from "../../domain/conflicts.js";
import type { NormalizedHermesRead } from "../normalized-read.js";

export function classifyMatchingProviders(
  read: NormalizedHermesRead,
): MatchingProviderConflict {
  const matchingEntries = read.namedCustomProviders
    .filter((entry) => entry.canonicalUrlFieldKeys.length > 0)
    .map<MatchingProviderMatch>((entry) => ({
      entry,
      scrubFields: collectScrubFields(entry),
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

  if (singleMatch === undefined || singleMatch.scrubFields.length === 0) {
    return {
      kind: "matching_provider",
      matchingEntries,
      status: "compatible",
    };
  }

  return {
    kind: "matching_provider",
    matchingEntries: [singleMatch],
    status: "scrubbable",
  };
}

function collectScrubFields(
  entry: NormalizedHermesRead["namedCustomProviders"][number],
): readonly MatchingProviderScrubField[] {
  const scrubFields: MatchingProviderScrubField[] = [];

  if (entry.apiKey.length > 0) {
    scrubFields.push("api_key");
  }

  if (entry.rawEntry.api_key_env !== undefined) {
    scrubFields.push("api_key_env");
  }

  if (entry.rawEntry.key_env !== undefined) {
    scrubFields.push("key_env");
  }

  if (entry.apiMode.length > 0 && entry.apiMode !== "chat_completions") {
    scrubFields.push("api_mode");
  }

  if (entry.sourceShape === "providers") {
    if (entry.transport.length > 0 && entry.transport !== "openai_chat") {
      scrubFields.push("transport");
    }
  }

  for (const fieldKey of entry.nonCanonicalUrlFieldKeys) {
    switch (fieldKey) {
      case "api":
        scrubFields.push("api");
        break;
      case "url":
        scrubFields.push("url");
        break;
      case "base_url":
        scrubFields.push("base_url_alias");
        break;
      default:
        break;
    }
  }

  return [...new Set(scrubFields)];
}
