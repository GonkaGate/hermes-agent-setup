import type {
  MatchingProviderScrubField,
  PreWriteReviewPlan,
} from "../domain/conflicts.js";
import type {
  ConfigMutationPlan,
  EnvMutationPlan,
  PhaseFourReview,
} from "../domain/writes.js";

const REVIEW_PROMPT_MESSAGE =
  "Continue with the planned GonkaGate Hermes changes?";

export interface CreatePhaseFourReviewInput {
  configPath: string;
  configPlan: ConfigMutationPlan;
  envPath: string;
  envPlan: EnvMutationPlan;
  reviewPlan: PreWriteReviewPlan;
  selectedModelId: string;
}

export function createPhaseFourReview(
  input: CreatePhaseFourReviewInput,
): PhaseFourReview {
  const lines = [
    "GonkaGate onboarding review",
    `Config path: ${input.configPath}`,
    `Env path: ${input.envPath}`,
    `Selected model: ${input.selectedModelId}`,
    ...renderConfigChanges(input.configPlan),
    ...renderEnvChanges(input.envPlan),
    ...renderConfirmationItems(input.reviewPlan),
    ...renderAdvisories(input.reviewPlan),
    "",
  ];

  return {
    confirmationRequired: input.reviewPlan.confirmationItems.length > 0,
    promptMessage: REVIEW_PROMPT_MESSAGE,
    text: lines.join("\n"),
  };
}

function renderConfigChanges(plan: ConfigMutationPlan): readonly string[] {
  if (!plan.changed) {
    return ["Config changes: none"];
  }

  return [
    "Config changes:",
    ...plan.actions.map((action) =>
      action.kind === "set"
        ? `- Set ${action.fieldPath} = ${action.nextValueDisplay ?? ""}`
        : `- Clear ${action.fieldPath}`,
    ),
  ];
}

function renderEnvChanges(plan: EnvMutationPlan): readonly string[] {
  if (!plan.changed) {
    return ["Env changes: none"];
  }

  return [
    "Env changes:",
    ...plan.actions.map((action) =>
      action.kind === "set"
        ? `- Set ${action.key} = ${action.nextValueDisplay ?? ""}`
        : `- Clear ${action.key}`,
    ),
  ];
}

function renderConfirmationItems(
  reviewPlan: PreWriteReviewPlan,
): readonly string[] {
  if (reviewPlan.confirmationItems.length === 0) {
    return ["Confirmation: not required"];
  }

  const lines = ["Confirmation required before writing:"];

  for (const item of reviewPlan.confirmationItems) {
    switch (item.kind) {
      case "shared_openai_key_takeover":
        lines.push(
          ...item.conflicts.map(
            (conflict) =>
              `- Shared OPENAI_API_KEY takeover affects ${conflict.label} at ${conflict.location}`,
          ),
        );
        break;
      case "file_openai_base_url_cleanup":
        lines.push(
          `- Clear file-backed OPENAI_BASE_URL=${item.conflict.value}`,
        );
        break;
      case "matching_provider_scrub": {
        const [match] = item.conflict.matchingEntries;

        if (match !== undefined) {
          lines.push(
            `- Scrub matching provider "${match.entry.name}" fields: ${match.scrubFields
              .map(formatScrubField)
              .join(", ")}`,
          );
        }

        break;
      }
      default:
        break;
    }
  }

  return lines;
}

function renderAdvisories(reviewPlan: PreWriteReviewPlan): readonly string[] {
  if (reviewPlan.advisories.length === 0) {
    return [];
  }

  return [
    "Advisories:",
    ...reviewPlan.advisories.map(
      (advisory) =>
        `- ${advisory.source === "inherited_process" ? "Shell-owned" : "File-backed"} OPENAI_BASE_URL remains visible as ${advisory.value}`,
    ),
  ];
}

function formatScrubField(field: MatchingProviderScrubField): string {
  switch (field) {
    case "base_url_alias":
      return "base_url";
    default:
      return field;
  }
}
