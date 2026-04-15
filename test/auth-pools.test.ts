import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { classifyAuthPoolConflict } from "../src/hermes/conflicts/auth-pools.js";
import { classifyMatchingProviders } from "../src/hermes/conflicts/matching-providers.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadNormalizedReadForFixture } from "./helpers/phase-two.js";

test("auth pool classifier blocks when credential_pool.custom:* still contains credentials for a matching provider", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "auth-pool-conflict",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const providerConflict = classifyMatchingProviders(readResult.read);
    const authPoolConflict = classifyAuthPoolConflict(
      readResult.read,
      providerConflict,
    );

    assert.deepEqual(authPoolConflict, {
      credentialCount: 1,
      kind: "auth_pool",
      matchingProviderName: "gonkagate",
      poolKey: "custom:gonkagate",
      status: "blocking",
    });
  } finally {
    await harness.cleanup();
  }
});

test("auth pool classifier returns none when auth.json is absent", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(
      classifyAuthPoolConflict(
        readResult.read,
        classifyMatchingProviders(readResult.read),
      ),
      {
        kind: "auth_pool",
        status: "none",
      },
    );
  } finally {
    await harness.cleanup();
  }
});

test("auth pool classifier returns none when a matching provider exists but no credential pool entry survives", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "providers-dict-match",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(
      classifyAuthPoolConflict(
        readResult.read,
        classifyMatchingProviders(readResult.read),
      ),
      {
        kind: "auth_pool",
        status: "none",
      },
    );
  } finally {
    await harness.cleanup();
  }
});

test("auth pool loading fails safely when auth.json exists but cannot be read", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "auth-pool-conflict",
  });
  const authPath = resolve(harness.hermesHomeDir, "auth.json");

  try {
    await harness.installFakeHermesOnPath();
    const readResult = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        fs: {
          async readFile(path, encoding) {
            if (path === authPath) {
              throw createPermissionError("blocked auth.json read");
            }

            return await readFile(path, encoding);
          },
        },
      },
    });

    assert.equal(readResult.ok, false);

    if (readResult.ok) {
      return;
    }

    assert.equal(readResult.failure.code, "auth_config_read_failed");
  } finally {
    await harness.cleanup();
  }
});

function createPermissionError(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = "EACCES";

  return error;
}
