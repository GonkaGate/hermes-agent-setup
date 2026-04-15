import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { classifySharedOpenAiKeyConflicts } from "../src/hermes/conflicts/shared-openai-key.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadNormalizedReadForFixture } from "./helpers/phase-two.js";

test("shared OPENAI_API_KEY classifier detects the main custom endpoint surface", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-main-custom",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(classifySharedOpenAiKeyConflicts(readResult.read), [
      {
        kind: "shared_openai_key",
        label: "Main custom endpoint",
        location: "model",
        reason: "uses_shared_openai_api_key",
        status: "confirmation_required",
        surfaceId: "main_custom_endpoint",
      },
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY classifier detects the main OpenRouter fallback surface", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-main-openrouter",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const conflicts = classifySharedOpenAiKeyConflicts(readResult.read);

    assert.equal(conflicts[0]?.surfaceId, "main_openrouter_fallback");
  } finally {
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY classifier treats direct smart routing as a takeover surface unless api_key_env proves a dedicated secret", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-smart-direct",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(
      classifySharedOpenAiKeyConflicts(readResult.read).map(
        (conflict) => conflict.surfaceId,
      ),
      ["smart_cheap_route_direct_endpoint"],
    );

    const isolatedReadResult = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        runtime: {
          env: {
            CHEAP_SMART_KEY: "dedicated-smart-route-secret",
          },
        },
      },
    });

    assert.equal(isolatedReadResult.ok, true);

    if (!isolatedReadResult.ok) {
      return;
    }

    assert.deepEqual(
      classifySharedOpenAiKeyConflicts(isolatedReadResult.read),
      [],
    );
  } finally {
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY classifier blocks ambiguous cheap_model.provider=custom without base_url", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-ambiguous-cheap-custom",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const conflicts = classifySharedOpenAiKeyConflicts(readResult.read);

    assert.equal(conflicts[0]?.surfaceId, "smart_cheap_route_ambiguous_custom");
    assert.equal(conflicts[0]?.status, "blocking");
  } finally {
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY classifier enumerates auxiliary, delegation, fallback, and voice tooling surfaces", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-secondary-surfaces",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(
      classifySharedOpenAiKeyConflicts(readResult.read)
        .map((conflict) => conflict.surfaceId)
        .sort(),
      [
        "auxiliary_direct_endpoint",
        "auxiliary_openrouter_override",
        "delegation_direct_endpoint",
        "fallback_direct_endpoint",
        "openai_voice_tooling",
      ],
    );
  } finally {
    await harness.cleanup();
  }
});

test("shared OPENAI_API_KEY classifier includes cron job ids for OpenRouter and direct cron surfaces", async () => {
  const openRouterHarness = await createHermesIntegrationHarness({
    fixture: "shared-key-openrouter-cron",
  });
  const directHarness = await createHermesIntegrationHarness({
    fixture: "cron-conflict",
  });

  try {
    await openRouterHarness.installFakeHermesOnPath();
    await directHarness.installFakeHermesOnPath();

    const openRouterReadResult =
      await loadNormalizedReadForFixture(openRouterHarness);
    const directReadResult = await loadNormalizedReadForFixture(directHarness);

    assert.equal(openRouterReadResult.ok, true);
    assert.equal(directReadResult.ok, true);

    if (!openRouterReadResult.ok || !directReadResult.ok) {
      return;
    }

    const [openRouterConflict] = classifySharedOpenAiKeyConflicts(
      openRouterReadResult.read,
    );
    const [directConflict] = classifySharedOpenAiKeyConflicts(
      directReadResult.read,
    );

    assert.equal(openRouterConflict?.surfaceId, "cron_openrouter_override");
    assert.equal(openRouterConflict?.jobId, "nightly-openrouter");
    assert.equal(directConflict?.surfaceId, "cron_direct_endpoint");
    assert.equal(directConflict?.jobId, "nightly-gonkagate");
  } finally {
    await openRouterHarness.cleanup();
    await directHarness.cleanup();
  }
});

test("shared OPENAI_API_KEY classification fails safely when cron/jobs.json exists but cannot be read", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "shared-key-openrouter-cron",
  });
  const cronJobsPath = resolve(harness.hermesHomeDir, "cron", "jobs.json");

  try {
    await harness.installFakeHermesOnPath();
    const readResult = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        fs: {
          async readFile(path, encoding) {
            if (path === cronJobsPath) {
              throw createPermissionError("blocked cron/jobs.json read");
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

    assert.equal(readResult.failure.code, "cron_config_read_failed");
  } finally {
    await harness.cleanup();
  }
});

function createPermissionError(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = "EACCES";

  return error;
}
