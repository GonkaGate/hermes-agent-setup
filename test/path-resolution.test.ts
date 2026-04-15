import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { resolveHermesContext } from "../src/hermes/path-resolution.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

test("path resolution uses the current Hermes context by default", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await resolveHermesContext({}, harness.createDependencies());

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.context, {
      configPath: resolve(harness.hermesHomeDir, "config.yaml"),
      envPath: resolve(harness.hermesHomeDir, ".env"),
      homeDir: resolve(harness.hermesHomeDir),
      profileMode: "current_context",
      profileName: undefined,
    });
    assert.deepEqual(await harness.readFakeHermesInvocations(), [
      ["config", "path"],
      ["config", "env-path"],
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("path resolution respects explicit HERMES_HOME through the Hermes CLI seam", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await resolveHermesContext(
      {},
      harness.createDependencies({
        runtime: {
          env: {
            HOME: join(harness.rootDir, "other-home"),
            HERMES_HOME: harness.hermesHomeDir,
          },
        },
      }),
    );

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.context.configPath,
      resolve(harness.hermesHomeDir, "config.yaml"),
    );
    assert.equal(
      result.context.envPath,
      resolve(harness.hermesHomeDir, ".env"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("path resolution follows the Hermes sticky profile without adding --profile", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath({
      activeProfile: "work",
    });

    const result = await resolveHermesContext({}, harness.createDependencies());

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.context, {
      configPath: resolve(
        harness.hermesHomeDir,
        "profiles",
        "work",
        "config.yaml",
      ),
      envPath: resolve(harness.hermesHomeDir, "profiles", "work", ".env"),
      homeDir: resolve(harness.hermesHomeDir, "profiles", "work"),
      profileMode: "current_context",
      profileName: undefined,
    });
    assert.deepEqual(await harness.readFakeHermesInvocations(), [
      ["config", "path"],
      ["config", "env-path"],
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("path resolution forwards explicit --profile to Hermes", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await resolveHermesContext(
      {
        profile: "team",
      },
      harness.createDependencies(),
    );

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.context, {
      configPath: resolve(
        harness.hermesHomeDir,
        "profiles",
        "team",
        "config.yaml",
      ),
      envPath: resolve(harness.hermesHomeDir, "profiles", "team", ".env"),
      homeDir: resolve(harness.hermesHomeDir, "profiles", "team"),
      profileMode: "explicit_profile",
      profileName: "team",
    });
    assert.deepEqual(await harness.readFakeHermesInvocations(), [
      ["--profile", "team", "config", "path"],
      ["--profile", "team", "config", "env-path"],
    ]);
  } finally {
    await harness.cleanup();
  }
});
