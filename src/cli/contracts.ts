import type { OnboardResult, OnboardCliOptions } from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export type { OnboardCliOptions };

export interface OutputWriter {
  write(text: string): void;
}

export interface ProgramOutput {
  writeErr?: (text: string) => void;
  writeOut?: (text: string) => void;
}

export interface CliRunOptions {
  dependencies?: OnboardDependencies;
  stderr?: OutputWriter;
  stdout?: OutputWriter;
}

export interface CliRunResult {
  exitCode: number;
  result?: OnboardResult;
}

export interface CliExecutionResult extends CliRunResult {
  stderrText?: string;
  stdoutText?: string;
}

export interface CliBufferedOutput {
  output: ProgramOutput;
  stderrText: string;
  stdoutText: string;
}

export type CliExecutionOutcome =
  | {
      bufferedOutput: CliBufferedOutput;
      result: OnboardResult;
      type: "result";
    }
  | {
      bufferedOutput: CliBufferedOutput;
      error: unknown;
      type: "error";
    };
