import type {
  AuthPoolConflict,
  MatchingProviderConflict,
} from "../../domain/conflicts.js";
import type { NormalizedHermesRead } from "../normalized-read.js";
import { isRecord } from "../provider-utils.js";

export function classifyAuthPoolConflict(
  read: NormalizedHermesRead,
  matchingProviders: MatchingProviderConflict,
): AuthPoolConflict {
  if (read.raw.auth.status !== "ok" || !isRecord(read.raw.auth.data)) {
    return {
      kind: "auth_pool",
      status: "none",
    };
  }

  const credentialPool = read.raw.auth.data.credential_pool;

  if (!isRecord(credentialPool)) {
    return {
      kind: "auth_pool",
      status: "none",
    };
  }

  const matchingEntries =
    matchingProviders.status === "none"
      ? []
      : matchingProviders.matchingEntries;

  for (const match of matchingEntries) {
    const poolKey = match.entry.matchingPoolKey;
    const credentialCount = countCredentials(credentialPool[poolKey]);

    if (credentialCount > 0) {
      return {
        credentialCount,
        kind: "auth_pool",
        matchingProviderName: match.entry.name,
        poolKey,
        status: "blocking",
      };
    }
  }

  return {
    kind: "auth_pool",
    status: "none",
  };
}

function countCredentials(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isRecord(value) && Array.isArray(value.credentials)) {
    return value.credentials.length;
  }

  return 0;
}
