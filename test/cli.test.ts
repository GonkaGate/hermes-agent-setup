import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { parseCliOptions, run } from "../src/cli.js";
import { createNodeOnboardDependencies } from "../src/runtime/dependencies.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const binPath = resolve(repoRoot, CONTRACT_METADATA.binPath);

interface BufferWriter {
  contents: string;
  write(text: string): void;
}

function createBufferWriter(): BufferWriter {
  return {
    contents: "",
    write(text) {
      this.contents += text;
    },
  };
}

test("parseCliOptions reads the public profile flag", () => {
  assert.deepEqual(parseCliOptions(["--profile", "work"]), {
    profile: "work",
  });
});

test("CLI help renders the shipped helper contract surface", () => {
  const result = spawnSync(process.execPath, [binPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: hermes-agent-setup/i);
  assert.match(result.stdout, /onboarding helper/i);
  assert.match(result.stdout, /--profile <name>/);
  assert.match(result.stdout, /The onboarding runtime is implemented/i);
  assert.match(
    result.stdout,
    /docs\/launch-qualification\/hermes-agent-setup\/v2026\.4\.13/,
  );
  assert.match(result.stdout, /https:\/\/api\.gonkagate\.com\/v1/);
});

test("symlinked entrypoints keep working for both shipped bin names", (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "gonkagate-hermes-bins-"));

  t.after(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  for (const binName of [
    CONTRACT_METADATA.binName,
    CONTRACT_METADATA.legacyBinName,
  ]) {
    const linkedBinPath = resolve(tempDir, binName);

    try {
      symlinkSync(binPath, linkedBinPath, "file");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "EPERM"
      ) {
        t.skip("Symlinks are unavailable in this environment.");
        return;
      }

      throw error;
    }

    const helpResult = spawnSync(process.execPath, [linkedBinPath, "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    assert.equal(helpResult.status, 0);
    assert.match(helpResult.stdout, /Usage: hermes-agent-setup/i);
    assert.match(helpResult.stdout, /--profile <name>/);
  }
});

test("supported setup completes the public onboarding flow end to end", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const modelsServer = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ id: "qwen/qwen3-235b-a22b-instruct-2507-fp8" }],
      object: "list",
    },
  });
  const configPath = resolve(harness.hermesHomeDir, "config.yaml");
  const envPath = resolve(harness.hermesHomeDir, ".env");

  try {
    await harness.installFakeHermesOnPath();
    harness.queueSecretPromptResponses("gp-cli-secret");

    const result = await run([], {
      dependencies: harness.createDependencies({
        http: {
          fetch: modelsServer.createFetchOverride(),
        },
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
        sleep: async () => {},
      }),
      stderr,
      stdout,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.result?.status, "success");
    assert.match(stdout.contents, /GonkaGate onboarding review/);
    assert.match(stdout.contents, /GonkaGate onboarding completed\./);
    assert.match(stdout.contents, /Config path:/);
    assert.match(stdout.contents, /Env path:/);
    assert.match(
      stdout.contents,
      /model\.default = qwen\/qwen3-235b-a22b-instruct-2507-fp8/,
    );
    assert.match(stdout.contents, /Saved OPENAI_API_KEY/);
    assert.equal(stderr.contents, "");
    assert.deepEqual(YAML.parse(readFileSync(configPath, "utf8")), {
      model: {
        base_url: "https://api.gonkagate.com/v1",
        default: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
        provider: "custom",
      },
    });
    assert.equal(
      readFileSync(envPath, "utf8"),
      "OPENAI_API_KEY=gp-cli-secret\n",
    );
    assert.equal(modelsServer.getRequestCount(), 1);
    assert.deepEqual(await harness.readFakeHermesInvocations(), [
      ["--version"],
      ["config", "path"],
      ["config", "env-path"],
    ]);
  } finally {
    await modelsServer.close();
    await harness.cleanup();
  }
});

test("missing Hermes on PATH aborts before the command can continue", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const result = await run([], {
    dependencies: createNodeOnboardDependencies({
      runtime: {
        env: {
          ...process.env,
          PATH: "",
        },
        osRelease: "6.8.0",
        platform: "linux",
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.result?.status, "failure");
  assert.equal(result.result?.code, "hermes_not_found");
  assert.match(stdout.contents, /Hermes Agent was not found on PATH/i);
  assert.equal(stderr.contents, "");
});

test("missing TTY aborts before the helper calls Hermes", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();

  try {
    await harness.installFakeHermesOnPath();

    const result = await run([], {
      dependencies: harness.createDependencies({
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: false,
          stdoutIsTTY: false,
        },
      }),
      stderr,
      stdout,
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.result?.status, "failure");
    assert.equal(result.result?.code, "missing_tty");
    assert.deepEqual(await harness.readFakeHermesInvocations(), []);
    assert.match(stdout.contents, /TTY is required/i);
    assert.equal(stderr.contents, "");
  } finally {
    await harness.cleanup();
  }
});
