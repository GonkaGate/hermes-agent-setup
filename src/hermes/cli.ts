import type { OnboardDependencies } from "../runtime/dependencies.js";

export const HERMES_COMMAND = "hermes";

export type HermesCliFailure =
  | {
      args: readonly string[];
      cause: unknown;
      kind: "not_found";
    }
  | {
      args: readonly string[];
      exitCode: number;
      signal: NodeJS.Signals | null;
      stderr: string;
      stdout: string;
      kind: "nonzero_exit";
    }
  | {
      args: readonly string[];
      reason: string;
      stderr: string;
      stdout: string;
      kind: "invalid_stdout";
    };

export type HermesCliResult =
  | {
      args: readonly string[];
      ok: true;
      stdout: string;
    }
  | {
      failure: HermesCliFailure;
      ok: false;
    };

export async function ensureHermesAvailable(
  dependencies: OnboardDependencies,
): Promise<HermesCliResult> {
  return await runHermesCommand(["--version"], dependencies);
}

export async function runHermesCommand(
  args: readonly string[],
  dependencies: OnboardDependencies,
): Promise<HermesCliResult> {
  try {
    const result = await dependencies.commands.execFile(HERMES_COMMAND, args, {
      cwd: dependencies.runtime.cwd,
      env: dependencies.runtime.env,
    });

    if (result.exitCode !== 0) {
      return {
        failure: {
          args,
          exitCode: result.exitCode,
          kind: "nonzero_exit",
          signal: result.signal,
          stderr: result.stderr,
          stdout: result.stdout,
        },
        ok: false,
      };
    }

    const stdout = result.stdout.trim();

    if (stdout.length === 0) {
      return {
        failure: {
          args,
          kind: "invalid_stdout",
          reason: "empty_stdout",
          stderr: result.stderr,
          stdout: result.stdout,
        },
        ok: false,
      };
    }

    return {
      args,
      ok: true,
      stdout,
    };
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      return {
        failure: {
          args,
          cause: error,
          kind: "not_found",
        },
        ok: false,
      };
    }

    throw error;
  }
}

function isCommandNotFoundError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
