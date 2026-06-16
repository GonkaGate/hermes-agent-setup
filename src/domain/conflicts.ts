import type { NormalizedNamedCustomProviderEntry } from "../hermes/normalized-read.js";

export type ConfigPathSegment = string | number;

export type SharedOpenAiKeySurfaceId =
  | "main_custom_endpoint"
  | "main_openrouter_fallback"
  | "smart_cheap_route_openrouter"
  | "smart_cheap_route_direct_endpoint"
  | "smart_cheap_route_ambiguous_custom"
  | "auxiliary_openrouter_override"
  | "auxiliary_direct_endpoint"
  | "delegation_direct_endpoint"
  | "fallback_openrouter_route"
  | "fallback_direct_endpoint"
  | "cron_openrouter_override"
  | "cron_direct_endpoint"
  | "openai_voice_tooling";

export interface SharedOpenAiKeyConflict {
  kind: "shared_openai_key";
  surfaceId: SharedOpenAiKeySurfaceId;
  label: string;
  location: string;
  status: "blocking" | "confirmation_required";
  reason:
    | "ambiguous_custom_provider_without_base_url"
    | "uses_shared_openai_api_key";
  jobId?: string;
  jobName?: string;
}

export interface MatchingProviderMatch {
  entry: NormalizedNamedCustomProviderEntry;
}

export type MatchingProviderConflict =
  | {
      kind: "matching_provider";
      matchingEntries: readonly [];
      status: "none";
    }
  | {
      kind: "matching_provider";
      matchingEntries: readonly MatchingProviderMatch[];
      status: "compatible";
    }
  | {
      kind: "matching_provider";
      matchingEntries: readonly MatchingProviderMatch[];
      reason: "multiple_matching_entries" | "non_managed_matching_entry";
      status: "blocking";
    };

export type AuthPoolConflict =
  | {
      kind: "auth_pool";
      status: "none";
    }
  | {
      kind: "auth_pool";
      credentialCount: number;
      matchingProviderName: string;
      poolKey: string;
      status: "blocking";
    };

export interface PlannedConfigScrub {
  fieldPath: string;
  pathSegments: readonly ConfigPathSegment[];
  reason: string;
  target: "model" | "named_provider";
  providerName?: string;
}

export type PreWriteReviewBlockingFinding =
  | AuthPoolConflict
  | SharedOpenAiKeyConflict
  | Extract<MatchingProviderConflict, { status: "blocking" }>;

export type PreWriteReviewConfirmationItem = {
  conflicts: readonly SharedOpenAiKeyConflict[];
  kind: "shared_openai_key_takeover";
};

export interface PreWriteReviewPlan {
  blockingFindings: readonly PreWriteReviewBlockingFinding[];
  confirmationItems: readonly PreWriteReviewConfirmationItem[];
  plannedConfigScrubs: readonly PlannedConfigScrub[];
}
