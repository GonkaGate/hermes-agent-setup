import { CommanderError } from "commander";
import type {
  OnboardCancelledResult,
  OnboardFailure,
  OnboardPreflightSuccessResult,
  OnboardSuccessResult,
  OnboardResult,
} from "../domain/runtime.js";
import { redactUnknownErrorMessage } from "../runtime/redaction.js";
import { renderOnboardCancelled, renderOnboardSuccess } from "../ui/success.js";
import type { CliExecutionOutcome, CliExecutionResult } from "./contracts.js";

export interface CliEntrypointErrorRenderResult {
  exitCode: number;
  stderrText?: string;
}

export function renderCliExecution(
  outcome: CliExecutionOutcome,
): CliExecutionResult {
  if (outcome.type === "result") {
    return finalizeCliExecution(outcome, {
      exitCode:
        outcome.result.status === "failure" ||
        outcome.result.status === "cancelled"
          ? 1
          : 0,
      result: outcome.result,
      stdoutText: renderCliResult(outcome.result),
    });
  }

  if (outcome.error instanceof CommanderError) {
    return finalizeCliExecution(outcome, {
      exitCode: outcome.error.exitCode,
    });
  }

  const renderedError = renderCliEntrypointError(outcome.error);

  return finalizeCliExecution(outcome, {
    exitCode: renderedError.exitCode,
    stderrText: renderedError.stderrText,
  });
}

export function renderCliEntrypointError(
  error: unknown,
): CliEntrypointErrorRenderResult {
  if (error instanceof CommanderError) {
    return {
      exitCode: error.exitCode,
    };
  }

  return {
    exitCode: 1,
    stderrText: `Error: ${formatUnexpectedCliErrorMessage(error)}\n`,
  };
}

function renderCliResult(result: OnboardResult): string {
  if (result.status === "failure") {
    return renderFailure(result);
  }

  if (result.status === "success-preflight") {
    return renderPreflightSuccess(result);
  }

  if (result.status === "cancelled") {
    return renderOnboardCancelled(result);
  }

  return renderOnboardSuccess(result);
}

function renderFailure(result: OnboardFailure): string {
  return [
    "GonkaGate onboarding failed.",
    result.message,
    ...(result.guidance === undefined ? [] : [result.guidance]),
    "",
  ].join("\n");
}

function renderPreflightSuccess(result: OnboardPreflightSuccessResult): string {
  return [
    "GonkaGate onboarding preflight checks passed.",
    formatResolvedContext(result.preflight),
    `Config path: ${result.preflight.configPath}`,
    `Env path: ${result.preflight.envPath}`,
    result.message,
    "",
  ].join("\n");
}

function formatResolvedContext(
  result:
    | OnboardCancelledResult["preflight"]
    | OnboardPreflightSuccessResult["preflight"]
    | OnboardSuccessResult["preflight"],
): string {
  if (result.profileMode === "explicit_profile") {
    return `Resolved Hermes context: profile "${result.profileName ?? "unknown"}"`;
  }

  return "Resolved Hermes context: current Hermes context";
}

function formatUnexpectedCliErrorMessage(error: unknown): string {
  return redactUnknownErrorMessage(error);
}

function finalizeCliExecution(
  outcome: CliExecutionOutcome,
  options: {
    exitCode: number;
    result?: OnboardResult;
    stderrText?: string;
    stdoutText?: string;
  },
): CliExecutionResult {
  return {
    exitCode: options.exitCode,
    result: options.result,
    stderrText: mergeBufferedText(
      outcome.bufferedOutput.stderrText,
      options.stderrText,
    ),
    stdoutText: mergeBufferedText(
      outcome.bufferedOutput.stdoutText,
      options.stdoutText,
    ),
  };
}

function mergeBufferedText(
  existingText: string,
  nextText = "",
): string | undefined {
  const mergedText = `${existingText}${nextText}`;

  return mergedText === "" ? undefined : mergedText;
}
