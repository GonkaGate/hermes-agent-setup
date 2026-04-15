import assert from "node:assert/strict";
import test from "node:test";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadNormalizedReadForFixture } from "./helpers/phase-two.js";

test("normalized read tolerates a missing config.yaml and keeps the read model empty", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "missing-config",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await loadNormalizedReadForFixture(harness);

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(result.read.raw.config.status, "missing");
    assert.deepEqual(result.read.config.model, {
      api: "",
      apiKey: "",
      apiMode: "",
      baseUrl: "",
      defaultModel: "",
      provider: "",
    });
    assert.deepEqual(result.read.namedCustomProviders, []);
  } finally {
    await harness.cleanup();
  }
});

test("normalized read fails safely on malformed YAML", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "malformed-yaml",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await loadNormalizedReadForFixture(harness);

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "config_parse_failed");
  } finally {
    await harness.cleanup();
  }
});

test("normalized read migrates legacy root provider/base_url into model.*", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "legacy-root-config",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await loadNormalizedReadForFixture(harness);

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.read.config.model, {
      api: "",
      apiKey: "",
      apiMode: "",
      baseUrl: "https://legacy-endpoint.example/v1",
      defaultModel: "qwen3-32b",
      provider: "custom",
    });
  } finally {
    await harness.cleanup();
  }
});

test("normalized read expands ${VAR} values and keeps file/process env provenance separate", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "env-expansion",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await loadNormalizedReadForFixture(harness, {
      dependencyOverrides: {
        runtime: {
          env: {
            CHEAP_API_KEY: "process-cheap-secret",
            GONKAGATE_PROVIDER_API: "https://process-provider.example/v1",
            OPENAI_BASE_URL: "https://process-openai.example/v1",
          },
        },
      },
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.read.env.file.OPENAI_BASE_URL,
      "https://file-env.example/v1",
    );
    assert.equal(
      result.read.env.inheritedProcess.OPENAI_BASE_URL,
      "https://process-openai.example/v1",
    );
    assert.equal(
      result.read.env.mergedRuntimeVisible.OPENAI_BASE_URL,
      "https://file-env.example/v1",
    );
    assert.equal(
      result.read.config.model.baseUrl,
      "https://file-env.example/v1",
    );
    assert.equal(
      result.read.config.smartModelRouting.cheapModel.baseUrl,
      "https://cheap-endpoint.example/v1",
    );
    assert.equal(
      result.read.namedCustomProviders[0]?.resolvedBaseUrl,
      "https://api.gonkagate.com/v1",
    );
    assert.deepEqual(
      result.read.namedCustomProviders[0]?.canonicalUrlFieldKeys,
      ["api"],
    );
  } finally {
    await harness.cleanup();
  }
});

test("normalized read supports the providers: dict shape and assigns custom:<normalized-name> pool keys", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "providers-dict-match",
  });

  try {
    await harness.installFakeHermesOnPath();

    const result = await loadNormalizedReadForFixture(harness);

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.read.namedCustomProviders, [
      {
        apiKey: "inline-provider-key",
        apiMode: "codex_responses",
        canonicalUrlFieldKeys: ["api"],
        keyEnv: "",
        matchingPoolKey: "custom:gonkagate",
        name: "gonkagate",
        nonCanonicalUrlFieldKeys: [],
        normalizedName: "gonkagate",
        path: "providers.gonkagate",
        pathSegments: ["providers", "gonkagate"],
        rawEntry: {
          api: "https://api.gonkagate.com/v1",
          api_key: "inline-provider-key",
          api_mode: "codex_responses",
          transport: "responses",
        },
        resolvedBaseUrl: "https://api.gonkagate.com/v1",
        sourceShape: "providers",
        transport: "responses",
        urlFieldValues: {
          api: "https://api.gonkagate.com/v1",
        },
      },
    ]);
  } finally {
    await harness.cleanup();
  }
});
