import { CANONICAL_BASE_URL } from "../constants/contract.js";
import type {
  OnboardCancelledResult,
  OnboardSuccessResult,
  PreflightReport,
} from "../domain/runtime.js";

export function renderOnboardSuccess(result: OnboardSuccessResult): string {
  const lines = [
    "GonkaGate onboarding completed.",
    formatResolvedContext(result.preflight),
    `Config path: ${result.preflight.configPath}`,
    `Env path: ${result.preflight.envPath}`,
    "Saved settings:",
    "- model.provider = custom",
    `- model.base_url = ${CANONICAL_BASE_URL}`,
    `- model.default = ${result.selectedModelId}`,
    "Applied file changes:",
    ...renderAppliedChanges(result),
    ...renderAdvisories(result),
    "Next steps:",
    "- Run `hermes` in this resolved context to start using the configured GonkaGate model.",
    "- The live `/v1/models` check confirmed auth and catalog visibility only. It did not verify billing/quota for the first billable request or full Hermes runtime readiness.",
    "",
  ];

  return lines.join("\n");
}

export function renderOnboardCancelled(result: OnboardCancelledResult): string {
  return [
    "GonkaGate onboarding cancelled.",
    formatResolvedContext(result.preflight),
    `Config path: ${result.preflight.configPath}`,
    `Env path: ${result.preflight.envPath}`,
    result.message,
    "",
  ].join("\n");
}

function renderAppliedChanges(result: OnboardSuccessResult): readonly string[] {
  const lines = [
    ...result.writeResult.config.actions
      .filter((action) => action.kind === "delete")
      .map((action) => `- Cleared ${action.fieldPath}`),
    ...result.writeResult.env.actions.map((action) =>
      action.kind === "delete"
        ? `- Cleared ${action.key}`
        : "- Saved OPENAI_API_KEY in the resolved Hermes .env file.",
    ),
  ];

  return lines.length > 0
    ? lines
    : ["- No cleanup beyond the managed GonkaGate settings was required."];
}

function renderAdvisories(result: OnboardSuccessResult): readonly string[] {
  if (result.reviewPlan.advisories.length === 0) {
    return [];
  }

  return [
    "Advisories:",
    ...result.reviewPlan.advisories.map(
      (advisory) =>
        `- ${advisory.source === "inherited_process" ? "Shell-owned" : "File-backed"} OPENAI_BASE_URL remains visible as ${advisory.value}`,
    ),
  ];
}

function formatResolvedContext(result: PreflightReport): string {
  if (result.profileMode === "explicit_profile") {
    return `Resolved Hermes context: profile "${result.profileName ?? "unknown"}"`;
  }

  return "Resolved Hermes context: current Hermes context";
}
