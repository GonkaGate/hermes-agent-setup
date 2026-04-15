import { access as accessPath } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { runPreflightChecks } from "../src/runtime/preconditions.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

test("supported preflight returns a success report without writing files", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "success-preflight");

    if (result.status !== "success-preflight") {
      return;
    }

    assert.match(result.message, /Preflight checks passed/i);
    assert.equal(result.preflight.platform, "linux");
    assert.equal(
      result.preflight.configPath,
      resolve(harness.hermesHomeDir, "config.yaml"),
    );
    assert.equal(
      result.preflight.envPath,
      resolve(harness.hermesHomeDir, ".env"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("unsupported win32 aborts before Hermes is invoked", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          osRelease: "10.0.26100",
          platform: "win32",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "unsupported_platform");
    assert.deepEqual(await harness.readFakeHermesInvocations(), []);
  } finally {
    await harness.cleanup();
  }
});

test("unsupported android aborts before Hermes is invoked", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          osRelease: "android14",
          platform: "android",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "unsupported_platform");
    assert.deepEqual(await harness.readFakeHermesInvocations(), []);
  } finally {
    await harness.cleanup();
  }
});

test("Termux-like environments abort before Hermes is invoked", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          env: {
            PREFIX: "/data/data/com.termux/files/usr",
            TERMUX_VERSION: "0.118.0",
          },
          osRelease: "6.6.30",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "unsupported_platform");
    assert.deepEqual(await harness.readFakeHermesInvocations(), []);
  } finally {
    await harness.cleanup();
  }
});

test("managed installs are blocked through HERMES_MANAGED", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          env: {
            HERMES_MANAGED: "1",
          },
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "managed_install");
  } finally {
    await harness.cleanup();
  }
});

test("managed installs are blocked through the .managed marker", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "managed-install",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "managed_install");
  } finally {
    await harness.cleanup();
  }
});

test("write-blocked targets are surfaced explicitly", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const blockedConfigPath = resolve(harness.hermesHomeDir, "config.yaml");

  try {
    await harness.installFakeHermesOnPath();

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        fs: {
          async access(path, mode) {
            if (path === blockedConfigPath) {
              const error = new Error("blocked") as NodeJS.ErrnoException;
              error.code = "EACCES";
              throw error;
            }

            await accessPath(path, mode);
          },
        },
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "write_blocked");
  } finally {
    await harness.cleanup();
  }
});

test("invalid Hermes path output becomes an explicit path-resolution failure", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath({
      configPathOutput: "relative-config.yaml",
    });

    const result = await runPreflightChecks(
      {},
      harness.createDependencies({
        runtime: {
          osRelease: "6.8.0",
          platform: "linux",
          stdinIsTTY: true,
          stdoutIsTTY: true,
        },
      }),
    );

    assert.equal(result.status, "failure");

    if (result.status !== "failure") {
      return;
    }

    assert.equal(result.code, "path_resolution_failed");
  } finally {
    await harness.cleanup();
  }
});
