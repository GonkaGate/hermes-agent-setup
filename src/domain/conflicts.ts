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

export interface OpenAiBaseUrlConflict {
  kind: "openai_base_url";
  source: "file" | "inherited_process";
  status: "advisory" | "blocking" | "confirmation_required" | "planned_cleanup";
  value: string;
  canonicalValue: string;
  resolution:
    | "clear_file_value"
    | "clear_file_value_without_confirmation"
    | "unset_shell_and_rerun"
    | "warn_same_shell_runtime";
}

export type MatchingProviderScrubField =
  | "api"
  | "api_key"
  | "api_key_env"
  | "api_mode"
  | "base_url_alias"
  | "key_env"
  | "transport"
  | "url";

export interface MatchingProviderMatch {
  entry: NormalizedNamedCustomProviderEntry;
  scrubFields: readonly MatchingProviderScrubField[];
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
      matchingEntries: readonly [MatchingProviderMatch];
      status: "scrubbable";
    }
  | {
      kind: "matching_provider";
      matchingEntries: readonly MatchingProviderMatch[];
      reason: "multiple_matching_entries";
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

export interface PlannedEnvCleanup {
  confirmationRequired: boolean;
  existingValue: string;
  key: "OPENAI_BASE_URL";
  reason: string;
  source: "file";
}

export type PreWriteReviewBlockingFinding =
  | AuthPoolConflict
  | OpenAiBaseUrlConflict
  | SharedOpenAiKeyConflict
  | Extract<MatchingProviderConflict, { status: "blocking" }>;

export type PreWriteReviewConfirmationItem =
  | {
      conflicts: readonly SharedOpenAiKeyConflict[];
      kind: "shared_openai_key_takeover";
    }
  | {
      conflict: OpenAiBaseUrlConflict;
      kind: "file_openai_base_url_cleanup";
    }
  | {
      conflict: Extract<MatchingProviderConflict, { status: "scrubbable" }>;
      kind: "matching_provider_scrub";
    };

export type PreWriteReviewAdvisory = OpenAiBaseUrlConflict;

export interface PreWriteReviewPlan {
  advisories: readonly PreWriteReviewAdvisory[];
  blockingFindings: readonly PreWriteReviewBlockingFinding[];
  confirmationItems: readonly PreWriteReviewConfirmationItem[];
  plannedConfigScrubs: readonly PlannedConfigScrub[];
  plannedEnvCleanup: readonly PlannedEnvCleanup[];
}
