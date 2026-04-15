export const CONTRACT_METADATA = {
  binName: "hermes-agent-setup",
  legacyBinName: "gonkagate-hermes-agent-setup",
  binPath: "bin/gonkagate-hermes-agent-setup.js",
  cliVersion: "0.1.0", // x-release-please-version
  packageName: "@gonkagate/hermes-agent-setup",
  packageDescription:
    "GonkaGate onboarding helper for configuring Hermes Agent.",
  publicEntrypoint: "npx @gonkagate/hermes-agent-setup",
  prdPath: "docs/specs/hermes-agent-setup-prd/spec.md",
  canonicalBaseUrl: "https://api.gonkagate.com/v1",
  pinnedHermesReleaseTag: "v2026.4.13",
  pinnedHermesVersion: "v0.9.0",
  launchQualificationArtifactRoot:
    "docs/launch-qualification/hermes-agent-setup",
  nodeFloor: ">=22.14.0",
  runtimePublicState:
    "The onboarding runtime is implemented: the CLI resolves the active Hermes context, prompts for a hidden GonkaGate key, intersects the live /v1/models catalog with checked-in launch qualification artifacts, plans conflict cleanup, writes config.yaml before .env with backups and rollback, and prints a final summary without claiming end-to-end billing readiness.",
  supportedPlatforms: ["linux", "macos", "wsl2"] as const,
  explicitlyUnsupportedPlatforms: ["win32", "android", "termux"] as const,
  helperManagedConfigKeys: [
    "model.provider",
    "model.base_url",
    "model.default",
  ] as const,
  helperManagedSecretEnvKeys: ["OPENAI_API_KEY"] as const,
  helperCleanupConfigKeys: [
    "model.api_key",
    "model.api",
    "model.api_mode",
  ] as const,
} as const;

export const PACKAGE_NAME = CONTRACT_METADATA.packageName;
export const PRIMARY_BIN_NAME = CONTRACT_METADATA.binName;
export const SECONDARY_BIN_NAME = CONTRACT_METADATA.legacyBinName;
export const PACKAGE_DESCRIPTION = CONTRACT_METADATA.packageDescription;
export const CANONICAL_BASE_URL = CONTRACT_METADATA.canonicalBaseUrl;
export const PRD_PATH = CONTRACT_METADATA.prdPath;
export const PINNED_HERMES_RELEASE_TAG =
  CONTRACT_METADATA.pinnedHermesReleaseTag;
