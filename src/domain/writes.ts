import type { ConfigPathSegment, PreWriteReviewPlan } from "./conflicts.js";
import type { OnboardFailure } from "./runtime.js";

export type FileMutationTarget = "config" | "env";

export interface ConfigMutationAction {
  fieldPath: string;
  kind: "delete" | "set";
  nextValueDisplay?: string;
  pathSegments: readonly ConfigPathSegment[];
}

export interface EnvMutationAction {
  key: string;
  kind: "delete" | "set";
  nextValueDisplay?: string;
  sensitive?: boolean;
}

export interface BaseTextMutationPlan {
  changed: boolean;
  existedBefore: boolean;
  nextContents: string;
  path: string;
  target: FileMutationTarget;
}

export interface ConfigMutationPlan extends BaseTextMutationPlan {
  actions: readonly ConfigMutationAction[];
  target: "config";
}

export interface EnvMutationPlan extends BaseTextMutationPlan {
  actions: readonly EnvMutationAction[];
  orderedKeys: readonly string[];
  target: "env";
}

export interface PhaseFourReview {
  confirmationRequired: boolean;
  promptMessage: string;
  text: string;
}

export interface PhaseFourWritePlan {
  config: ConfigMutationPlan;
  env: EnvMutationPlan;
  review: PhaseFourReview;
  reviewPlan: PreWriteReviewPlan;
  selectedModelId: string;
}

export interface PhaseFourBackupArtifact {
  backupPath?: string;
  existedBefore: boolean;
  mode?: number;
  path: string;
  target: FileMutationTarget;
}

export interface PhaseFourExecutionSuccess {
  backups: readonly PhaseFourBackupArtifact[];
  config: ConfigMutationPlan;
  env: EnvMutationPlan;
  reviewText: string;
}

export type PhaseFourExecutionResult =
  | {
      ok: true;
      result: PhaseFourExecutionSuccess;
      status: "written";
    }
  | {
      ok: false;
      reviewText: string;
      status: "cancelled";
    }
  | {
      failure: OnboardFailure;
      ok: false;
      reviewText: string;
      status: "failure";
    };
