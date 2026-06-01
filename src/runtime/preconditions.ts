import { constants as fsConstants } from "node:fs";
import { dirname, join } from "node:path";
import semver from "semver";
import { CONTRACT_METADATA } from "../constants/contract.js";
import {
  createOnboardFailure,
  type OnboardCliOptions,
  type OnboardFailure,
  type OnboardPreflightSuccessResult,
  type PreflightReport,
} from "../domain/runtime.js";
import { ensureHermesAvailable, type HermesCliFailure } from "../hermes/cli.js";
import { resolveHermesContext } from "../hermes/path-resolution.js";
import type { OnboardDependencies } from "./dependencies.js";

export async function runPreflightChecks(
  options: OnboardCliOptions,
  dependencies: OnboardDependencies,
): Promise<OnboardFailure | OnboardPreflightSuccessResult> {
  if (
    !semver.satisfies(
      dependencies.runtime.nodeVersion,
      CONTRACT_METADATA.nodeFloor,
    )
  ) {
    return createOnboardFailure("unsupported_node", {
      details: {
        minimumVersion: CONTRACT_METADATA.nodeFloor,
        nodeVersion: dependencies.runtime.nodeVersion,
      },
      guidance: `Upgrade Node.js to ${CONTRACT_METADATA.nodeFloor} and rerun ${CONTRACT_METADATA.publicEntrypoint}.`,
      message: `Node.js ${dependencies.runtime.nodeVersion} is below the supported floor ${CONTRACT_METADATA.nodeFloor}.`,
    });
  }

  if (!dependencies.runtime.stdinIsTTY || !dependencies.runtime.stdoutIsTTY) {
    return createOnboardFailure("missing_tty", {
      details: {
        stdinIsTTY: dependencies.runtime.stdinIsTTY,
        stdoutIsTTY: dependencies.runtime.stdoutIsTTY,
      },
      guidance:
        "Run the helper in an interactive terminal before the hidden API key prompt phase begins.",
      message:
        "A TTY is required for the interactive GonkaGate onboarding flow.",
    });
  }

  const supportedPlatform = resolveSupportedPlatform(dependencies);

  if (!supportedPlatform.ok) {
    return supportedPlatform.failure;
  }

  const hermesPresence = await ensureHermesAvailable(dependencies);

  if (!hermesPresence.ok) {
    return createHermesAvailabilityFailure(hermesPresence.failure);
  }

  const hermesVersionCheck = validateHermesVersion(hermesPresence.stdout);

  if (!hermesVersionCheck.ok) {
    return createOnboardFailure("unsupported_hermes_version", {
      details: {
        minimumReleaseTag: CONTRACT_METADATA.minimumHermesReleaseTag,
        minimumVersion: CONTRACT_METADATA.minimumHermesVersion,
        reason: hermesVersionCheck.reason,
        versionOutput: hermesPresence.stdout,
      },
      guidance: `Upgrade Hermes Agent to ${CONTRACT_METADATA.minimumHermesReleaseTag} / ${CONTRACT_METADATA.minimumHermesVersion} or newer, then rerun ${CONTRACT_METADATA.publicEntrypoint}.`,
      message:
        hermesVersionCheck.reason === "unparseable"
          ? "Hermes returned a version string that the helper cannot validate against the supported latest-only contract."
          : `Hermes Agent ${hermesVersionCheck.version} is below the supported floor ${CONTRACT_METADATA.minimumHermesVersion} (${CONTRACT_METADATA.minimumHermesReleaseTag}).`,
    });
  }

  const contextResult = await resolveHermesContext(options, dependencies);

  if (!contextResult.ok) {
    return createOnboardFailure("path_resolution_failed", {
      details:
        "pathType" in contextResult.failure
          ? {
              pathType: contextResult.failure.pathType,
              reason: contextResult.failure.reason,
              stdout: contextResult.failure.stdout,
            }
          : {
              hermesArgs: contextResult.failure.args.join(" "),
              hermesFailureKind: contextResult.failure.kind,
            },
      guidance:
        "Check that `hermes config path` and `hermes config env-path` work in the same shell, then rerun the helper.",
      message:
        "Hermes did not return a usable config or env path for the requested context.",
    });
  }

  const managedInstallFailure = await detectManagedInstall(
    contextResult.context.homeDir,
    dependencies,
  );

  if (managedInstallFailure !== undefined) {
    return managedInstallFailure;
  }

  const writableTargetsFailure = await ensureWritableTargets(
    [contextResult.context.configPath, contextResult.context.envPath],
    dependencies,
  );

  if (writableTargetsFailure !== undefined) {
    return writableTargetsFailure;
  }

  const preflight: PreflightReport = {
    ...contextResult.context,
    hermesCommand: "hermes",
    hermesVersion: hermesVersionCheck.version,
    nodeVersion: dependencies.runtime.nodeVersion,
    platform: supportedPlatform.platform,
  };

  return {
    message:
      "Preflight checks passed. The helper has not prompted for secrets, fetched models, or written any files yet.",
    preflight,
    status: "success-preflight",
  };
}

function createHermesAvailabilityFailure(
  failure: HermesCliFailure,
): OnboardFailure {
  const hermesArgs = failure.args.join(" ");

  if (failure.kind === "not_found") {
    return createOnboardFailure("hermes_not_found", {
      details: {
        hermesArgs,
        hermesFailureKind: failure.kind,
      },
      guidance:
        "Install `hermes` so it is available on PATH, then rerun the helper.",
      message:
        "Hermes Agent was not found on PATH, so onboarding cannot resolve the active config context yet.",
    });
  }

  if (failure.kind === "timed_out") {
    return createOnboardFailure("hermes_unavailable", {
      details: {
        hermesArgs,
        hermesFailureKind: failure.kind,
        timeoutMs: failure.timeoutMs,
      },
      guidance:
        "Check that `hermes --version` completes in this shell, repair or reinstall Hermes Agent if needed, then rerun the helper.",
      message: `Hermes Agent did not respond to \`hermes ${hermesArgs}\` within ${failure.timeoutMs} ms, so onboarding cannot safely continue.`,
    });
  }

  if (failure.kind === "nonzero_exit") {
    return createOnboardFailure("hermes_unavailable", {
      details: {
        exitCode: failure.exitCode,
        hermesArgs,
        hermesFailureKind: failure.kind,
        ...(failure.errorCode === undefined
          ? {}
          : {
              errorCode: failure.errorCode,
            }),
      },
      guidance:
        "Check that `hermes --version` completes successfully in this shell, repair or reinstall Hermes Agent if needed, then rerun the helper.",
      message:
        "Hermes Agent returned a non-zero status for `hermes --version`, so onboarding cannot resolve the active config context yet.",
    });
  }

  return createOnboardFailure("hermes_unavailable", {
    details: {
      hermesArgs,
      hermesFailureKind: failure.kind,
      reason: failure.reason,
    },
    guidance:
      "Check that `hermes --version` prints a usable version in this shell, repair or reinstall Hermes Agent if needed, then rerun the helper.",
    message:
      "Hermes Agent did not return usable output for `hermes --version`, so onboarding cannot resolve the active config context yet.",
  });
}

type HermesVersionCheckResult =
  | {
      ok: true;
      version: string;
    }
  | {
      ok: false;
      reason: "below_minimum" | "unparseable";
      version?: string;
    };

function validateHermesVersion(stdout: string): HermesVersionCheckResult {
  const parsedSemver = parseHermesSemver(stdout);

  if (parsedSemver !== undefined) {
    return semver.gte(parsedSemver, CONTRACT_METADATA.minimumHermesVersion)
      ? {
          ok: true,
          version: parsedSemver,
        }
      : {
          ok: false,
          reason: "below_minimum",
          version: parsedSemver,
        };
  }

  const parsedReleaseTag = parseHermesReleaseTag(stdout);

  if (parsedReleaseTag !== undefined) {
    return compareReleaseTags(
      parsedReleaseTag,
      CONTRACT_METADATA.minimumHermesReleaseTag,
    ) >= 0
      ? {
          ok: true,
          version: parsedReleaseTag,
        }
      : {
          ok: false,
          reason: "below_minimum",
          version: parsedReleaseTag,
        };
  }

  return {
    ok: false,
    reason: "unparseable",
  };
}

function parseHermesSemver(stdout: string): string | undefined {
  const versionMatches = stdout.matchAll(
    /(?:^|[\s(])v?(\d+\.\d+\.\d+)(?=$|[\s),])/gu,
  );

  for (const match of versionMatches) {
    const candidate = match[1];

    if (candidate === undefined) {
      continue;
    }

    const [majorText] = candidate.split(".");
    const major = Number(majorText);

    if (!Number.isFinite(major) || major >= 1000) {
      continue;
    }

    const cleanedVersion = semver.clean(candidate);

    if (cleanedVersion !== null) {
      return cleanedVersion;
    }
  }

  return undefined;
}

function parseHermesReleaseTag(stdout: string): string | undefined {
  const match = stdout.match(
    /(?:^|[\s(])v?(20\d{2})\.(\d{1,2})\.(\d{1,2})(?=$|[\s),])/u,
  );

  if (match === null) {
    return undefined;
  }

  return `v${match[1]}.${Number(match[2])}.${Number(match[3])}`;
}

function compareReleaseTags(left: string, right: string): number {
  const leftParts = parseReleaseTagParts(left);
  const rightParts = parseReleaseTagParts(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function parseReleaseTagParts(tag: string): readonly [number, number, number] {
  const match = tag.match(/^v(20\d{2})\.(\d{1,2})\.(\d{1,2})$/u);

  if (match === null) {
    return [0, 0, 0];
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function detectManagedInstall(
  homeDir: string,
  dependencies: OnboardDependencies,
): Promise<OnboardFailure | undefined> {
  if ((dependencies.runtime.env.HERMES_MANAGED ?? "").trim().length > 0) {
    return createOnboardFailure("managed_install", {
      details: {
        source: "HERMES_MANAGED",
      },
      guidance:
        "Use a user-managed Hermes install before continuing with GonkaGate onboarding.",
      message:
        "The resolved Hermes install is marked as managed through HERMES_MANAGED, so local onboarding writes are unsupported.",
    });
  }

  const managedMarkerPaths = new Set<string>([
    join(homeDir, ".managed"),
    ...(dependencies.runtime.env.HERMES_HOME === undefined
      ? []
      : [join(dependencies.runtime.env.HERMES_HOME, ".managed")]),
  ]);

  for (const markerPath of managedMarkerPaths) {
    try {
      const marker = await dependencies.fs.stat(markerPath);

      if (marker.isFile()) {
        return createOnboardFailure("managed_install", {
          details: {
            source: markerPath,
          },
          guidance:
            "Use a user-managed Hermes install before continuing with GonkaGate onboarding.",
          message:
            "The resolved Hermes install contains a .managed marker, so local onboarding writes are unsupported.",
        });
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      return createOnboardFailure("path_resolution_failed", {
        details: {
          markerPath,
        },
        guidance:
          "Check filesystem access to the resolved Hermes home and rerun the helper.",
        message:
          "The helper could not inspect the resolved Hermes managed-install marker safely.",
      });
    }
  }

  return undefined;
}

async function ensureWritableTargets(
  paths: readonly string[],
  dependencies: OnboardDependencies,
): Promise<OnboardFailure | undefined> {
  for (const path of paths) {
    const failure = await ensureWritableTarget(path, dependencies);

    if (failure !== undefined) {
      return failure;
    }
  }

  return undefined;
}

async function ensureWritableTarget(
  path: string,
  dependencies: OnboardDependencies,
): Promise<OnboardFailure | undefined> {
  try {
    const targetStats = await dependencies.fs.stat(path);

    if (targetStats.isDirectory()) {
      return createOnboardFailure("write_blocked", {
        details: {
          path,
          reason: "target_is_directory",
        },
        guidance:
          "Restore the expected file path or pick a user-managed Hermes context before rerunning the helper.",
        message: `The resolved target ${path} is a directory, so onboarding cannot write Hermes files safely.`,
      });
    }

    await dependencies.fs.access(path, fsConstants.W_OK);
  } catch (error) {
    if (isMissingPathError(error)) {
      const parentDirectory = dirname(path);

      try {
        await dependencies.fs.access(parentDirectory, fsConstants.W_OK);
      } catch (parentError) {
        return createOnboardFailure("write_blocked", {
          details: {
            path,
            parentDirectory,
            reason: extractErrorCode(parentError),
          },
          guidance:
            "Check filesystem permissions for the resolved Hermes context before rerunning the helper.",
          message: `The helper cannot write to ${path} because its parent directory is not writable.`,
        });
      }

      return undefined;
    }

    return createOnboardFailure("write_blocked", {
      details: {
        path,
        reason: extractErrorCode(error),
      },
      guidance:
        "Check filesystem permissions for the resolved Hermes context before rerunning the helper.",
      message: `The helper cannot access ${path} with the permissions required for later onboarding writes.`,
    });
  }

  return undefined;
}

function resolveSupportedPlatform(dependencies: OnboardDependencies):
  | {
      ok: true;
      platform: (typeof CONTRACT_METADATA.supportedPlatforms)[number];
    }
  | {
      failure: OnboardFailure;
      ok: false;
    } {
  const { env, osRelease, platform } = dependencies.runtime;

  if (platform === "win32" || platform === "android") {
    return {
      failure: createOnboardFailure("unsupported_platform", {
        details: {
          osRelease,
          platform,
        },
        guidance:
          "Use Linux, macOS, or WSL2 for the public GonkaGate onboarding flow.",
        message: `${platform} is outside the supported launch boundary for this helper.`,
      }),
      ok: false,
    };
  }

  if (
    platform === "linux" &&
    ((env.TERMUX_VERSION ?? "").trim().length > 0 ||
      (env.PREFIX ?? "").includes("com.termux"))
  ) {
    return {
      failure: createOnboardFailure("unsupported_platform", {
        details: {
          osRelease,
          platform: "termux",
        },
        guidance:
          "Use Linux, macOS, or WSL2 for the public GonkaGate onboarding flow.",
        message:
          "Termux-like environments are outside the supported launch boundary for this helper.",
      }),
      ok: false,
    };
  }

  if (platform === "darwin") {
    return {
      ok: true,
      platform: "macos",
    };
  }

  if (platform === "linux") {
    return {
      ok: true,
      platform: /microsoft/iu.test(osRelease) ? "wsl2" : "linux",
    };
  }

  return {
    failure: createOnboardFailure("unsupported_platform", {
      details: {
        osRelease,
        platform,
      },
      guidance:
        "Use Linux, macOS, or WSL2 for the public GonkaGate onboarding flow.",
      message: `${platform} is outside the supported launch boundary for this helper.`,
    }),
    ok: false,
  };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    ((error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR")
  );
}

function extractErrorCode(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (typeof code === "string") {
      return code;
    }
  }

  return "unknown_error";
}
