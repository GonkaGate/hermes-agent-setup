import { password, select } from "@inquirer/prompts";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { release as osRelease } from "node:os";
import process from "node:process";
import { promisify } from "node:util";
import type { Stats } from "node:fs";

const execFileAsync = promisify(execFile);

export interface OnboardRuntimeEnvironment {
  cwd: string;
  env: NodeJS.ProcessEnv;
  nodeVersion: string;
  osRelease: string;
  platform: NodeJS.Platform;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export interface OnboardCommandResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}

export interface OnboardCommandRunner {
  execFile(
    file: string,
    args: readonly string[],
    options?: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    },
  ): Promise<OnboardCommandResult>;
}

export interface OnboardSelectChoice<TValue extends string = string> {
  description?: string;
  label: string;
  value: TValue;
}

export interface OnboardSelectOptions<TValue extends string = string> {
  choices: readonly OnboardSelectChoice<TValue>[];
  defaultValue?: TValue;
  message: string;
  pageSize?: number;
}

export interface OnboardPrompts {
  readSecret(message: string): Promise<string>;
  selectOption<TValue extends string>(
    options: OnboardSelectOptions<TValue>,
  ): Promise<TValue>;
}

export interface OnboardHttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface OnboardFileSystem {
  access(path: string, mode?: number): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readdir(path: string): Promise<string[]>;
  removeFile(path: string): Promise<void>;
  stat(path: string): Promise<Stats>;
}

export interface OnboardDependencies {
  commands: OnboardCommandRunner;
  fs: OnboardFileSystem;
  http: OnboardHttpClient;
  prompts: OnboardPrompts;
  runtime: OnboardRuntimeEnvironment;
  sleep(durationMs: number): Promise<void>;
}

export interface CreateNodeOnboardDependenciesOverrides {
  commands?: Partial<OnboardCommandRunner>;
  fs?: Partial<OnboardFileSystem>;
  http?: Partial<OnboardHttpClient>;
  prompts?: Partial<OnboardPrompts>;
  runtime?: Partial<OnboardRuntimeEnvironment>;
  sleep?: OnboardDependencies["sleep"];
}

const DEFAULT_RUNTIME_ENVIRONMENT: OnboardRuntimeEnvironment = {
  cwd: process.cwd(),
  env: process.env,
  nodeVersion: process.version,
  osRelease: osRelease(),
  platform: process.platform,
  stdinIsTTY: process.stdin.isTTY ?? false,
  stdoutIsTTY: process.stdout.isTTY ?? false,
};

const NODE_FILE_SYSTEM: OnboardFileSystem = {
  access,
  chmod,
  copyFile,
  async readFile(path, encoding) {
    return await readFile(path, encoding);
  },
  async readdir(path) {
    return await readdir(path);
  },
  async removeFile(path) {
    await rm(path, { force: true });
  },
  stat,
};

const NODE_HTTP_CLIENT: OnboardHttpClient = {
  async fetch(url, init) {
    return await fetch(url, init);
  },
};

const NODE_PROMPTS: OnboardPrompts = {
  async readSecret(message) {
    return await password({
      mask: "*",
      message,
    });
  },
  async selectOption(options) {
    return await select({
      choices: options.choices.map((choice) => ({
        description: choice.description,
        name: choice.label,
        value: choice.value,
      })),
      default: options.defaultValue,
      message: options.message,
      pageSize: options.pageSize,
    });
  },
};

const NODE_COMMAND_RUNNER: OnboardCommandRunner = {
  async execFile(file, args, options) {
    try {
      const result = await execFileAsync(file, [...args], {
        cwd: options?.cwd,
        encoding: "utf8",
        env: options?.env,
        windowsHide: true,
      });

      return {
        exitCode: 0,
        signal: null,
        stderr: result.stderr,
        stdout: result.stdout,
      };
    } catch (error) {
      if (isExecFileExitError(error)) {
        return {
          exitCode: error.code ?? 1,
          signal: error.signal ?? null,
          stderr: toText(error.stderr),
          stdout: toText(error.stdout),
        };
      }

      throw error;
    }
  },
};

export function createNodeOnboardDependencies(
  overrides: CreateNodeOnboardDependenciesOverrides = {},
): OnboardDependencies {
  const runtimeOverrides = overrides.runtime ?? {};
  const runtime: OnboardRuntimeEnvironment = {
    cwd: runtimeOverrides.cwd ?? DEFAULT_RUNTIME_ENVIRONMENT.cwd,
    env:
      runtimeOverrides.env === undefined
        ? DEFAULT_RUNTIME_ENVIRONMENT.env
        : {
            ...DEFAULT_RUNTIME_ENVIRONMENT.env,
            ...runtimeOverrides.env,
          },
    nodeVersion:
      runtimeOverrides.nodeVersion ?? DEFAULT_RUNTIME_ENVIRONMENT.nodeVersion,
    osRelease:
      runtimeOverrides.osRelease ?? DEFAULT_RUNTIME_ENVIRONMENT.osRelease,
    platform: runtimeOverrides.platform ?? DEFAULT_RUNTIME_ENVIRONMENT.platform,
    stdinIsTTY:
      runtimeOverrides.stdinIsTTY ?? DEFAULT_RUNTIME_ENVIRONMENT.stdinIsTTY,
    stdoutIsTTY:
      runtimeOverrides.stdoutIsTTY ?? DEFAULT_RUNTIME_ENVIRONMENT.stdoutIsTTY,
  };

  return {
    commands: {
      ...NODE_COMMAND_RUNNER,
      ...overrides.commands,
    },
    fs: {
      ...NODE_FILE_SYSTEM,
      ...overrides.fs,
    },
    http: {
      ...NODE_HTTP_CLIENT,
      ...overrides.http,
    },
    prompts: {
      ...NODE_PROMPTS,
      ...overrides.prompts,
    },
    runtime,
    sleep: overrides.sleep ?? sleep,
  };
}

function isExecFileExitError(error: unknown): error is Error & {
  code?: number;
  signal?: NodeJS.Signals | null;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
} {
  return (
    error instanceof Error && "code" in error && typeof error.code === "number"
  );
}

function toText(value: string | Buffer | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Buffer) {
    return value.toString("utf8");
  }

  return "";
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
