import {
  CANONICAL_BASE_URL,
  GONKAGATE_API_KEY_ENV_VAR,
  GONKAGATE_PROVIDER_SELECTOR,
} from "../constants/contract.js";
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
    `- custom_providers[name=gonkagate].base_url = ${CANONICAL_BASE_URL}`,
    `- custom_providers[name=gonkagate].key_env = ${GONKAGATE_API_KEY_ENV_VAR}`,
    "- custom_providers[name=gonkagate].api_mode = chat_completions",
    "- custom_providers[name=gonkagate].models = qualified live GonkaGate models",
    `- model.provider = ${GONKAGATE_PROVIDER_SELECTOR}`,
    `- model.default = ${result.selectedModelId}`,
    "Applied file changes:",
    ...renderAppliedChanges(result),
    "Next steps:",
    "- Run `hermes` in this resolved context to start using the configured GonkaGate model.",
    `- Switch models with \`/model ${GONKAGATE_PROVIDER_SELECTOR}:${result.selectedModelId} --global\` or rerun the helper to pick another qualified live GonkaGate model.`,
    '- Optional smoke test: `hermes chat -Q --max-turns 1 -q "Do not use tools. Reply exactly: GonkaGate smoke test OK"` (sends one real model request).',
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
        : `- Saved ${GONKAGATE_API_KEY_ENV_VAR} in the resolved Hermes .env file.`,
    ),
  ];

  return lines.length > 0
    ? lines
    : ["- No cleanup beyond the managed GonkaGate settings was required."];
}

function formatResolvedContext(result: PreflightReport): string {
  if (result.profileMode === "explicit_profile") {
    return `Resolved Hermes context: profile "${result.profileName ?? "unknown"}"`;
  }

  return "Resolved Hermes context: current Hermes context";
}
