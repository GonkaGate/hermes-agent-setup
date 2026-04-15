import assert from "node:assert/strict";
import test from "node:test";
import { fetchGonkaGateLiveCatalog } from "../src/gonkagate/catalog-client.js";
import { validateGonkaGateApiKey } from "../src/validation/api-key.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";

function createValidatedApiKey() {
  const result = validateGonkaGateApiKey("gp-live-catalog-secret");

  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error("Expected a valid test API key.");
  }

  return result.apiKey;
}

test("catalog client uses the canonical /v1/models endpoint with Bearer auth", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [
        { id: "alpha/model-a" },
        { id: "beta/model-b" },
        { id: "alpha/model-a" },
      ],
      object: "list",
    },
  });

  try {
    const result = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      harness.createDependencies({
        http: {
          fetch: server.createFetchOverride(),
        },
        sleep: async () => {},
      }),
    );

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.deepEqual(result.catalog.modelIds, [
      "alpha/model-a",
      "beta/model-b",
    ]);

    const [request] = server.getCapturedRequests();

    assert.equal(request?.method, "GET");
    assert.equal(request?.url, "/v1/models");
    assert.equal(
      request?.headers.authorization,
      "Bearer gp-live-catalog-secret",
    );
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("catalog client treats 401 as a terminal auth failure", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      error: {
        code: "invalid_api_key",
      },
    },
    statusCode: 401,
  });

  try {
    const result = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      harness.createDependencies({
        http: {
          fetch: server.createFetchOverride(),
        },
        sleep: async () => {},
      }),
    );

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "catalog_auth_failed");
    assert.equal(result.attempts, 1);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("catalog client rejects malformed model payloads", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const server = await harness.startFakeModelsServer({
    responseBody: {
      data: [{ object: "model" }],
      object: "list",
    },
  });

  try {
    const result = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      harness.createDependencies({
        http: {
          fetch: server.createFetchOverride(),
        },
        sleep: async () => {},
      }),
    );

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "catalog_response_invalid");
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("catalog client retries retryable 5xx responses and then succeeds", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const sleepCalls: number[] = [];
  const server = await harness.startFakeModelsServer({
    responses: [
      {
        responseBody: {
          error: {
            message: "temporary outage",
          },
        },
        statusCode: 503,
      },
      {
        responseBody: {
          data: [{ id: "alpha/model-a" }],
          object: "list",
        },
        statusCode: 200,
      },
    ],
  });

  try {
    const result = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      harness.createDependencies({
        http: {
          fetch: server.createFetchOverride(),
        },
        sleep: async (durationMs) => {
          sleepCalls.push(durationMs);
        },
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.attempts, 2);
    assert.deepEqual(sleepCalls, [250]);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});

test("catalog client retries rate-limit 429 but does not retry insufficient_quota", async () => {
  const retryHarness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const retrySleepCalls: number[] = [];
  const retryServer = await retryHarness.startFakeModelsServer({
    responses: [
      {
        headers: {
          "retry-after": "1",
        },
        responseBody: {
          error: {
            code: "rate_limit_exceeded",
          },
        },
        statusCode: 429,
      },
      {
        responseBody: {
          data: [{ id: "alpha/model-a" }],
          object: "list",
        },
      },
    ],
  });

  try {
    const retryResult = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      retryHarness.createDependencies({
        http: {
          fetch: retryServer.createFetchOverride(),
        },
        sleep: async (durationMs) => {
          retrySleepCalls.push(durationMs);
        },
      }),
    );

    assert.equal(retryResult.ok, true);
    assert.deepEqual(retrySleepCalls, [250]);
  } finally {
    await retryServer.close();
    await retryHarness.cleanup();
  }

  const quotaHarness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const quotaServer = await quotaHarness.startFakeModelsServer({
    responseBody: {
      error: {
        code: "insufficient_quota",
        message: "billing required",
      },
    },
    statusCode: 429,
  });

  try {
    const quotaResult = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      quotaHarness.createDependencies({
        http: {
          fetch: quotaServer.createFetchOverride(),
        },
        sleep: async () => {},
      }),
    );

    assert.equal(quotaResult.ok, false);

    if (quotaResult.ok) {
      return;
    }

    assert.equal(quotaResult.failure.code, "catalog_auth_failed");
    assert.equal(quotaServer.getRequestCount(), 1);
  } finally {
    await quotaServer.close();
    await quotaHarness.cleanup();
  }
});

test("catalog client exhausts the retry budget on repeated transient failures", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });
  const sleepCalls: number[] = [];
  const server = await harness.startFakeModelsServer({
    responses: [
      {
        responseBody: {
          error: {
            message: "unavailable",
          },
        },
        statusCode: 503,
      },
      {
        responseBody: {
          error: {
            message: "still unavailable",
          },
        },
        statusCode: 503,
      },
      {
        responseBody: {
          error: {
            message: "again unavailable",
          },
        },
        statusCode: 503,
      },
    ],
  });

  try {
    const result = await fetchGonkaGateLiveCatalog(
      createValidatedApiKey(),
      harness.createDependencies({
        http: {
          fetch: server.createFetchOverride(),
        },
        sleep: async (durationMs) => {
          sleepCalls.push(durationMs);
        },
      }),
    );

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.failure.code, "catalog_retry_exhausted");
    assert.deepEqual(sleepCalls, [250, 500]);
  } finally {
    await server.close();
    await harness.cleanup();
  }
});
