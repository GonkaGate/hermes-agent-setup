import { CONTRACT_METADATA } from "../constants/contract.js";
import type { PreWriteReviewPlan } from "./conflicts.js";
import type { PhaseFourExecutionSuccess } from "./writes.js";

export type OnboardFailureFamily =
  | "runtime"
  | "config-read"
  | "conflict"
  | "catalog"
  | "write";

export type OnboardFailureCode =
  | "unsupported_node"
  | "missing_tty"
  | "unsupported_platform"
  | "hermes_not_found"
  | "managed_install"
  | "write_blocked"
  | "path_resolution_failed"
  | "config_parse_failed"
  | "env_read_failed"
  | "auth_config_read_failed"
  | "cron_config_read_failed"
  | "shared_api_key_conflict"
  | "model_auth_conflict"
  | "provider_conflict"
  | "auth_pool_conflict"
  | "inherited_base_url_conflict"
  | "file_backed_base_url_conflict"
  | "api_key_invalid"
  | "qualified_models_unavailable"
  | "catalog_auth_failed"
  | "catalog_retry_exhausted"
  | "catalog_response_invalid"
  | "backup_failed"
  | "config_write_failed"
  | "env_write_failed"
  | "rollback_failed";

export type OnboardFailureDetailValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export type OnboardFailureDetails = Readonly<
  Record<string, OnboardFailureDetailValue>
>;

export interface OnboardCliOptions {
  profile?: string;
}

export type ResolvedHermesProfileMode = "current_context" | "explicit_profile";

export interface ResolvedHermesContext {
  configPath: string;
  envPath: string;
  homeDir: string;
  profileMode: ResolvedHermesProfileMode;
  profileName?: string;
}

export interface PreflightReport extends ResolvedHermesContext {
  hermesCommand: "hermes";
  nodeVersion: string;
  platform: (typeof CONTRACT_METADATA.supportedPlatforms)[number];
}

export interface OnboardFailure {
  code: OnboardFailureCode;
  details?: OnboardFailureDetails;
  family: OnboardFailureFamily;
  guidance?: string;
  message: string;
  status: "failure";
}

export interface OnboardPreflightSuccessResult {
  message: string;
  preflight: PreflightReport;
  status: "success-preflight";
}

export interface OnboardCancelledResult {
  message: string;
  preflight: PreflightReport;
  reviewText: string;
  status: "cancelled";
}

export interface OnboardSuccessResult {
  preflight: PreflightReport;
  reviewPlan: PreWriteReviewPlan;
  selectedModelId: string;
  status: "success";
  writeResult: PhaseFourExecutionSuccess;
}

export type OnboardResult =
  | OnboardFailure
  | OnboardCancelledResult
  | OnboardPreflightSuccessResult
  | OnboardSuccessResult;

export const ONBOARD_FAILURE_FAMILY_BY_CODE = {
  unsupported_node: "runtime",
  missing_tty: "runtime",
  unsupported_platform: "runtime",
  hermes_not_found: "runtime",
  managed_install: "runtime",
  write_blocked: "runtime",
  path_resolution_failed: "runtime",
  config_parse_failed: "config-read",
  env_read_failed: "config-read",
  auth_config_read_failed: "config-read",
  cron_config_read_failed: "config-read",
  shared_api_key_conflict: "conflict",
  model_auth_conflict: "conflict",
  provider_conflict: "conflict",
  auth_pool_conflict: "conflict",
  inherited_base_url_conflict: "conflict",
  file_backed_base_url_conflict: "conflict",
  api_key_invalid: "catalog",
  qualified_models_unavailable: "catalog",
  catalog_auth_failed: "catalog",
  catalog_retry_exhausted: "catalog",
  catalog_response_invalid: "catalog",
  backup_failed: "write",
  config_write_failed: "write",
  env_write_failed: "write",
  rollback_failed: "write",
} as const satisfies Record<OnboardFailureCode, OnboardFailureFamily>;

export function createOnboardFailure(
  code: OnboardFailureCode,
  options: {
    details?: OnboardFailureDetails;
    guidance?: string;
    message: string;
  },
): OnboardFailure {
  return {
    code,
    details: options.details,
    family: ONBOARD_FAILURE_FAMILY_BY_CODE[code],
    guidance: options.guidance,
    message: options.message,
    status: "failure",
  };
}
