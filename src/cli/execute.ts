import { runOnboardCommand } from "../commands/onboard.js";
import { createNodeOnboardDependencies } from "../runtime/dependencies.js";
import type {
  CliBufferedOutput,
  CliExecutionResult,
  CliRunOptions,
  CliRunResult,
  OutputWriter,
} from "./contracts.js";
import { parseCliOptions } from "./parse.js";
import { renderCliExecution } from "./render.js";

export async function run(
  argv: string[] = [],
  options: CliRunOptions = {},
): Promise<CliRunResult> {
  const execution = await executeCli(argv, {
    dependencies: options.dependencies,
    stderr: options.stderr,
    stdout: options.stdout,
  });

  return {
    exitCode: execution.exitCode,
    result: execution.result,
  };
}

export async function executeCli(
  argv: string[],
  options: Pick<CliRunOptions, "dependencies" | "stderr" | "stdout"> = {},
): Promise<CliExecutionResult> {
  const bufferedOutput = createBufferedOutput({
    stderr: options.stderr,
    stdout: options.stdout,
  });

  try {
    const cliOptions = parseCliOptions(argv, bufferedOutput.output);
    const dependencies =
      options.dependencies ?? createNodeOnboardDependencies();
    const result = await runOnboardCommand(cliOptions, dependencies, {
      write(text) {
        bufferedOutput.output.writeOut?.(text);
      },
    });
    const execution = renderCliExecution({
      bufferedOutput,
      result,
      type: "result",
    });

    flushRenderedOutput(
      {
        stderr: options.stderr,
        stdout: options.stdout,
      },
      bufferedOutput,
      execution,
    );

    return execution;
  } catch (error) {
    const execution = renderCliExecution({
      bufferedOutput,
      error,
      type: "error",
    });

    flushRenderedOutput(
      {
        stderr: options.stderr,
        stdout: options.stdout,
      },
      bufferedOutput,
      execution,
    );

    return execution;
  }
}

function createBufferedOutput(options: {
  stderr?: OutputWriter;
  stdout?: OutputWriter;
}): CliBufferedOutput {
  const bufferedOutput: CliBufferedOutput = {
    output: {
      writeErr(text) {
        bufferedOutput.stderrText += text;
        options.stderr?.write(text);
      },
      writeOut(text) {
        bufferedOutput.stdoutText += text;
        options.stdout?.write(text);
      },
    },
    stderrText: "",
    stdoutText: "",
  };

  return bufferedOutput;
}

function flushRenderedOutput(
  writers: {
    stderr?: OutputWriter;
    stdout?: OutputWriter;
  },
  bufferedOutput: CliBufferedOutput,
  execution: CliExecutionResult,
): void {
  writeTail(writers.stdout, bufferedOutput.stdoutText, execution.stdoutText);
  writeTail(writers.stderr, bufferedOutput.stderrText, execution.stderrText);
}

function writeTail(
  writer: OutputWriter | undefined,
  prefix: string,
  mergedText: string | undefined,
): void {
  if (writer === undefined || mergedText === undefined) {
    return;
  }

  const nextText = mergedText.startsWith(prefix)
    ? mergedText.slice(prefix.length)
    : mergedText;

  if (nextText.length > 0) {
    writer.write(nextText);
  }
}
