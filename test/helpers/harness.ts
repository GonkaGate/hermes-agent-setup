import { execFile } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CONTRACT_METADATA } from "../../src/constants/contract.js";
import {
  createNodeOnboardDependencies,
  type CreateNodeOnboardDependenciesOverrides,
  type OnboardDependencies,
  type OnboardPrompts,
  type OnboardSelectOptions,
} from "../../src/runtime/dependencies.js";

interface FakeHermesProfileOverride {
  configPath: string;
  envPath: string;
}

export interface FakeHermesOptions {
  activeProfile?: string;
  configPathExitCode?: number;
  configPathOutput?: string;
  configPathStderr?: string;
  envPathExitCode?: number;
  envPathOutput?: string;
  envPathStderr?: string;
  profilePathOverrides?: Record<string, FakeHermesProfileOverride>;
  versionExitCode?: number;
  versionOutput?: string;
  versionStderr?: string;
}

export interface FakeModelsServerHandle {
  close(): Promise<void>;
  createFetchOverride(): OnboardDependencies["http"]["fetch"];
  getCapturedRequests(): readonly FakeModelsServerRequest[];
  getRequestCount(): number;
  url: string;
}

export interface FakeModelsServerRequest {
  body: string;
  headers: Readonly<Record<string, string>>;
  method: string;
  url: string;
}

export interface FakePromptInvocations {
  readSecretMessages: readonly string[];
  selectOptions: ReadonlyArray<{
    choices: readonly string[];
    defaultValue?: string;
    message: string;
  }>;
}

export interface FakeModelsServerResponse {
  contentType?: string;
  headers?: Readonly<Record<string, string>>;
  responseBody?: string | unknown;
  statusCode?: number;
}

export interface HermesIntegrationHarness {
  binDir: string;
  cleanup(): Promise<void>;
  createDependencies(
    overrides?: CreateNodeOnboardDependenciesOverrides,
  ): OnboardDependencies;
  hermesHomeDir: string;
  homeDir: string;
  installFakeHermesOnPath(options?: FakeHermesOptions): Promise<void>;
  readFakeHermesInvocations(): Promise<string[][]>;
  readPromptInvocations(): FakePromptInvocations;
  rootDir: string;
  queueSecretPromptResponses(...responses: string[]): void;
  queueSelectionResponses(...responses: string[]): void;
  startFakeModelsServer(options?: {
    responseBody?: unknown;
    responses?: readonly FakeModelsServerResponse[];
    statusCode?: number;
  }): Promise<FakeModelsServerHandle>;
  workspaceDir: string;
}

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/hermes-homes/", import.meta.url),
);
const fakeHermesFixturePath = fileURLToPath(
  new URL("./fake-hermes.mjs", import.meta.url),
);
const execFileAsync = promisify(execFile);

export async function createHermesIntegrationHarness(options: {
  fixture: string;
}): Promise<HermesIntegrationHarness> {
  const rootDir = await mkdtemp(join(tmpdir(), "gonkagate-hermes-setup-"));
  const homeDir = join(rootDir, "home");
  const binDir = join(rootDir, "bin");
  const workspaceDir = join(rootDir, "workspace");
  const fixturePath = resolve(fixtureRoot, options.fixture);
  const fakeHermesInvocationsPath = join(
    rootDir,
    "fake-hermes-invocations.log",
  );

  await cp(fixturePath, homeDir, {
    force: true,
    recursive: true,
  });
  await Promise.all([
    mkdir(binDir, { recursive: true }),
    mkdir(workspaceDir, { recursive: true }),
  ]);

  const hermesHomeDir = join(homeDir, ".hermes");
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
    PATH: [binDir, process.env.PATH ?? ""]
      .filter((value) => value.length > 0)
      .join(delimiter),
    ...(process.platform === "win32"
      ? {
          USERPROFILE: homeDir,
        }
      : {}),
  };
  let fakeHermesEnv: NodeJS.ProcessEnv = {};
  const secretPromptResponses: string[] = [];
  const selectionResponses: string[] = [];
  const promptInvocations = {
    readSecretMessages: [] as string[],
    selectOptions: [] as Array<{
      choices: string[];
      defaultValue?: string;
      message: string;
    }>,
  };

  const scriptedPrompts: OnboardPrompts = {
    async readSecret(message) {
      promptInvocations.readSecretMessages.push(message);

      const nextResponse = secretPromptResponses.shift();

      if (nextResponse === undefined) {
        throw new Error("No scripted secret prompt response is available.");
      }

      return nextResponse;
    },
    async selectOption<TValue extends string>(
      options: OnboardSelectOptions<TValue>,
    ): Promise<TValue> {
      promptInvocations.selectOptions.push({
        choices: options.choices.map((choice) => choice.value),
        defaultValue: options.defaultValue,
        message: options.message,
      });

      const nextResponse = selectionResponses.shift();

      if (nextResponse !== undefined) {
        return nextResponse as TValue;
      }

      const fallbackValue = options.defaultValue ?? options.choices[0]?.value;

      if (fallbackValue === undefined) {
        throw new Error("No scripted model selection response is available.");
      }

      return fallbackValue;
    },
  };

  return {
    binDir,
    async cleanup() {
      await rm(rootDir, { force: true, recursive: true });
    },
    createDependencies(overrides = {}) {
      const runtimeOverrides = overrides.runtime ?? {};
      const runtimeEnv = {
        ...baseEnv,
        ...fakeHermesEnv,
        ...runtimeOverrides.env,
      };

      return createNodeOnboardDependencies({
        commands: {
          ...overrides.commands,
          async execFile(file, args, execOptions) {
            if (overrides.commands?.execFile !== undefined) {
              return await overrides.commands.execFile(file, args, execOptions);
            }

            // `execFile()` cannot launch `.cmd` shims on Windows, so invoke
            // the fake Hermes script through Node directly for CI coverage.
            if (
              process.platform === "win32" &&
              file === "hermes" &&
              hasInstalledFakeHermes(runtimeEnv)
            ) {
              return await runExecFile(
                process.execPath,
                [fakeHermesFixturePath, ...args],
                {
                  cwd: execOptions?.cwd,
                  env: execOptions?.env ?? runtimeEnv,
                },
              );
            }

            return await runExecFile(file, args, execOptions);
          },
        },
        fs: overrides.fs,
        http: overrides.http,
        prompts: {
          ...scriptedPrompts,
          ...overrides.prompts,
        },
        runtime: {
          cwd: runtimeOverrides.cwd ?? workspaceDir,
          env: runtimeEnv,
          ...(runtimeOverrides.nodeVersion === undefined
            ? {}
            : { nodeVersion: runtimeOverrides.nodeVersion }),
          ...(runtimeOverrides.osRelease === undefined
            ? {}
            : { osRelease: runtimeOverrides.osRelease }),
          ...(runtimeOverrides.platform === undefined
            ? {}
            : { platform: runtimeOverrides.platform }),
          ...(runtimeOverrides.stdinIsTTY === undefined
            ? {}
            : { stdinIsTTY: runtimeOverrides.stdinIsTTY }),
          ...(runtimeOverrides.stdoutIsTTY === undefined
            ? {}
            : { stdoutIsTTY: runtimeOverrides.stdoutIsTTY }),
        },
        sleep: overrides.sleep,
      });
    },
    hermesHomeDir,
    homeDir,
    async installFakeHermesOnPath(options = {}) {
      if (process.platform === "win32") {
        const launcherPath = join(binDir, "hermes.cmd");
        const launcherContents = `@echo off\r\n"${process.execPath}" "${fakeHermesFixturePath}" %*\r\n`;

        await writeFile(launcherPath, launcherContents, "utf8");
      } else {
        const launcherPath = join(binDir, "hermes");
        const launcherContents = `#!${process.execPath}
import ${JSON.stringify(fakeHermesFixturePath)};
`;

        await writeFile(launcherPath, launcherContents, "utf8");
        await chmod(launcherPath, 0o755);
      }

      fakeHermesEnv = {
        GONKAGATE_FAKE_HERMES_ACTIVE_PROFILE: options.activeProfile ?? "",
        GONKAGATE_FAKE_HERMES_CONFIG_PATH_EXIT_CODE: String(
          options.configPathExitCode ?? 0,
        ),
        GONKAGATE_FAKE_HERMES_CONFIG_PATH_STDERR:
          options.configPathStderr ?? "",
        GONKAGATE_FAKE_HERMES_ENV_PATH_EXIT_CODE: String(
          options.envPathExitCode ?? 0,
        ),
        GONKAGATE_FAKE_HERMES_ENV_PATH_STDERR: options.envPathStderr ?? "",
        GONKAGATE_FAKE_HERMES_INVOCATIONS_FILE: fakeHermesInvocationsPath,
        GONKAGATE_FAKE_HERMES_PROFILE_PATHS_JSON:
          options.profilePathOverrides === undefined
            ? ""
            : JSON.stringify(options.profilePathOverrides),
        GONKAGATE_FAKE_HERMES_VERSION_EXIT_CODE: String(
          options.versionExitCode ?? 0,
        ),
        GONKAGATE_FAKE_HERMES_VERSION_OUTPUT:
          options.versionOutput ?? "hermes-agent 0.9.0",
        GONKAGATE_FAKE_HERMES_VERSION_STDERR: options.versionStderr ?? "",
        ...(options.configPathOutput === undefined
          ? {}
          : {
              GONKAGATE_FAKE_HERMES_CONFIG_PATH_OUTPUT:
                options.configPathOutput,
            }),
        ...(options.envPathOutput === undefined
          ? {}
          : {
              GONKAGATE_FAKE_HERMES_ENV_PATH_OUTPUT: options.envPathOutput,
            }),
      };
    },
    async readFakeHermesInvocations() {
      try {
        const contents = await readFile(fakeHermesInvocationsPath, "utf8");

        return contents
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as string[]);
      } catch {
        return [];
      }
    },
    readPromptInvocations() {
      return {
        readSecretMessages: [...promptInvocations.readSecretMessages],
        selectOptions: promptInvocations.selectOptions.map((invocation) => ({
          choices: [...invocation.choices],
          defaultValue: invocation.defaultValue,
          message: invocation.message,
        })),
      };
    },
    rootDir,
    queueSecretPromptResponses(...responses: string[]) {
      secretPromptResponses.push(...responses);
    },
    queueSelectionResponses(...responses: string[]) {
      selectionResponses.push(...responses);
    },
    async startFakeModelsServer(serverOptions = {}) {
      let requestCount = 0;
      const capturedRequests: FakeModelsServerRequest[] = [];
      const queuedResponses =
        serverOptions.responses === undefined ||
        serverOptions.responses.length === 0
          ? [
              {
                responseBody: serverOptions.responseBody ?? {
                  data: [],
                  object: "list",
                },
                statusCode: serverOptions.statusCode ?? 200,
              },
            ]
          : [...serverOptions.responses];
      const fallbackResponse = queuedResponses[queuedResponses.length - 1] ?? {
        responseBody: { data: [], object: "list" },
        statusCode: 200,
      };
      const server = createServer(async (request, response) => {
        requestCount += 1;

        const body = await readRequestBody(request);

        capturedRequests.push({
          body,
          headers: Object.fromEntries(
            Object.entries(request.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : (value ?? ""),
            ]),
          ),
          method: request.method ?? "GET",
          url: request.url ?? "/",
        });

        const nextResponse = queuedResponses.shift() ?? fallbackResponse;
        const responseBody =
          typeof nextResponse.responseBody === "string"
            ? nextResponse.responseBody
            : JSON.stringify(
                nextResponse.responseBody ?? { data: [], object: "list" },
              );

        response.statusCode = nextResponse.statusCode ?? 200;

        for (const [key, value] of Object.entries(nextResponse.headers ?? {})) {
          response.setHeader(key, value);
        }

        response.setHeader(
          "content-type",
          nextResponse.contentType ?? "application/json",
        );
        response.end(responseBody);
      });

      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", rejectPromise);
          resolvePromise();
        });
      });

      const address = server.address();

      if (address === null || typeof address === "string") {
        throw new Error("Failed to resolve fake models server address.");
      }

      const serverUrl = `http://127.0.0.1:${address.port}`;

      return {
        async close() {
          await new Promise<void>((resolvePromise, rejectPromise) => {
            server.close((error) => {
              if (error) {
                rejectPromise(error);
                return;
              }

              resolvePromise();
            });
          });
        },
        createFetchOverride() {
          return async (url, init) => {
            const requestedUrl = new URL(url);
            const rewrittenUrl = new URL(
              `${requestedUrl.pathname}${requestedUrl.search}`,
              `${serverUrl}/`,
            );

            if (
              `${requestedUrl.origin}${requestedUrl.pathname}`.startsWith(
                CONTRACT_METADATA.canonicalBaseUrl,
              )
            ) {
              return await fetch(rewrittenUrl, init);
            }

            return await fetch(url, init);
          };
        },
        getCapturedRequests() {
          return [...capturedRequests];
        },
        getRequestCount() {
          return requestCount;
        },
        url: serverUrl,
      };
    },
    workspaceDir,
  };
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  let body = "";

  for await (const chunk of request) {
    body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }

  return body;
}

function hasInstalledFakeHermes(env: NodeJS.ProcessEnv): boolean {
  return (
    typeof env.GONKAGATE_FAKE_HERMES_INVOCATIONS_FILE === "string" &&
    env.GONKAGATE_FAKE_HERMES_INVOCATIONS_FILE.trim().length > 0
  );
}

async function runExecFile(
  file: string,
  args: readonly string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  },
) {
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
