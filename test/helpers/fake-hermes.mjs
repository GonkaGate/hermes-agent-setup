import { appendFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const env = process.env;

recordInvocation(args);

if (args.length === 1 && args[0] === "--version") {
  respond({
    exitCode: Number(env.GONKAGATE_FAKE_HERMES_VERSION_EXIT_CODE ?? "0"),
    stderr: env.GONKAGATE_FAKE_HERMES_VERSION_STDERR ?? "",
    stdout: env.GONKAGATE_FAKE_HERMES_VERSION_OUTPUT ?? "hermes-agent 0.9.0",
  });
}

const { commandArgs, profile } = parseGlobalArgs(args);

if (commandArgs.length === 2 && commandArgs[0] === "config") {
  if (commandArgs[1] === "path") {
    const resolvedPaths = resolveContextPaths(profile);

    respond({
      exitCode: Number(env.GONKAGATE_FAKE_HERMES_CONFIG_PATH_EXIT_CODE ?? "0"),
      stderr: env.GONKAGATE_FAKE_HERMES_CONFIG_PATH_STDERR ?? "",
      stdout:
        env.GONKAGATE_FAKE_HERMES_CONFIG_PATH_OUTPUT ??
        resolvedPaths.configPath,
    });
  }

  if (commandArgs[1] === "env-path") {
    const resolvedPaths = resolveContextPaths(profile);

    respond({
      exitCode: Number(env.GONKAGATE_FAKE_HERMES_ENV_PATH_EXIT_CODE ?? "0"),
      stderr: env.GONKAGATE_FAKE_HERMES_ENV_PATH_STDERR ?? "",
      stdout:
        env.GONKAGATE_FAKE_HERMES_ENV_PATH_OUTPUT ?? resolvedPaths.envPath,
    });
  }
}

respond({
  exitCode: 64,
  stderr: `Unsupported fake hermes command: ${args.join(" ")}`,
  stdout: "",
});

function parseGlobalArgs(argv) {
  const nextArgs = [...argv];
  let profile;

  if (nextArgs[0] === "--profile") {
    profile = nextArgs[1];
    nextArgs.splice(0, 2);
  }

  return {
    commandArgs: nextArgs,
    profile,
  };
}

function resolveContextPaths(explicitProfile) {
  const stickyProfile = normalizeString(
    env.GONKAGATE_FAKE_HERMES_ACTIVE_PROFILE,
  );
  const profile = explicitProfile ?? stickyProfile;
  const overrides = parseProfileOverrides(
    env.GONKAGATE_FAKE_HERMES_PROFILE_PATHS_JSON,
  );

  if (profile !== undefined && overrides[profile] !== undefined) {
    return overrides[profile];
  }

  const hermesHome = resolveHermesHome();

  if (profile === undefined) {
    return {
      configPath: join(hermesHome, "config.yaml"),
      envPath: join(hermesHome, ".env"),
    };
  }

  return {
    configPath: join(hermesHome, "profiles", profile, "config.yaml"),
    envPath: join(hermesHome, "profiles", profile, ".env"),
  };
}

function resolveHermesHome() {
  const explicitHome = normalizeString(env.HERMES_HOME);

  if (explicitHome !== undefined) {
    return explicitHome;
  }

  const homeDir = normalizeString(env.HOME) ?? normalizeString(env.USERPROFILE);

  if (homeDir === undefined) {
    return process.cwd();
  }

  return join(homeDir, ".hermes");
}

function parseProfileOverrides(rawValue) {
  if (normalizeString(rawValue) === undefined) {
    return {};
  }

  return JSON.parse(rawValue);
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function recordInvocation(invocation) {
  const outputPath = env.GONKAGATE_FAKE_HERMES_INVOCATIONS_FILE;

  if (normalizeString(outputPath) === undefined) {
    return;
  }

  appendFileSync(outputPath, `${JSON.stringify(invocation)}\n`, "utf8");
}

function respond({ exitCode, stderr, stdout }) {
  if (stdout.length > 0) {
    process.stdout.write(`${stdout}\n`);
  }

  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  process.exit(exitCode);
}
