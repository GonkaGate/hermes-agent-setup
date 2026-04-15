import { dirname, isAbsolute } from "node:path";
import type {
  OnboardCliOptions,
  ResolvedHermesContext,
} from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import { runHermesCommand, type HermesCliFailure } from "./cli.js";

export type HermesPathResolutionResult =
  | {
      context: ResolvedHermesContext;
      ok: true;
    }
  | {
      failure:
        | HermesCliFailure
        | {
            kind: "invalid_path";
            pathType: "config" | "env";
            reason: string;
            stdout: string;
          };
      ok: false;
    };

export async function resolveHermesContext(
  options: OnboardCliOptions,
  dependencies: OnboardDependencies,
): Promise<HermesPathResolutionResult> {
  const globalArgs = buildHermesGlobalArgs(options);
  const configPathResult = await runHermesCommand(
    [...globalArgs, "config", "path"],
    dependencies,
  );

  if (!configPathResult.ok) {
    return configPathResult;
  }

  const envPathResult = await runHermesCommand(
    [...globalArgs, "config", "env-path"],
    dependencies,
  );

  if (!envPathResult.ok) {
    return envPathResult;
  }

  const configPath = validatePathOutput("config", configPathResult.stdout);

  if (configPath === undefined) {
    return {
      failure: {
        kind: "invalid_path",
        pathType: "config",
        reason: "non_absolute_or_multiline_path",
        stdout: configPathResult.stdout,
      },
      ok: false,
    };
  }

  const envPath = validatePathOutput("env", envPathResult.stdout);

  if (envPath === undefined) {
    return {
      failure: {
        kind: "invalid_path",
        pathType: "env",
        reason: "non_absolute_or_multiline_path",
        stdout: envPathResult.stdout,
      },
      ok: false,
    };
  }

  return {
    context: {
      configPath,
      envPath,
      homeDir: dirname(configPath),
      profileMode:
        options.profile === undefined ? "current_context" : "explicit_profile",
      profileName: options.profile,
    },
    ok: true,
  };
}

function buildHermesGlobalArgs(options: OnboardCliOptions): string[] {
  if (options.profile === undefined) {
    return [];
  }

  return ["--profile", options.profile];
}

function validatePathOutput(
  _pathType: "config" | "env",
  stdout: string,
): string | undefined {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== 1) {
    return undefined;
  }

  const [pathValue] = lines;

  if (pathValue === undefined || !isAbsolute(pathValue)) {
    return undefined;
  }

  return pathValue;
}
