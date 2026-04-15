import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  CatalogClientResult,
  LiveGonkaGateCatalog,
} from "../domain/catalog.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { ValidatedApiKey } from "../validation/api-key.js";
import {
  buildGonkaGateModelsUrl,
  isRetryableRateLimitResponse,
  parseHttpResponseBody,
} from "./http.js";

const CATALOG_RETRY_BACKOFF_MS = [250, 500] as const;
const CATALOG_RETRY_ATTEMPTS = CATALOG_RETRY_BACKOFF_MS.length + 1;

export async function fetchGonkaGateLiveCatalog(
  apiKey: ValidatedApiKey,
  dependencies: OnboardDependencies,
): Promise<CatalogClientResult> {
  for (let attempt = 1; attempt <= CATALOG_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await dependencies.http.fetch(
        buildGonkaGateModelsUrl(),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          method: "GET",
        },
      );
      const responseBody = await parseHttpResponseBody(response);

      if (response.status === 401) {
        return {
          attempts: attempt,
          failure: createCatalogAuthFailure(response.status, "invalid_api_key"),
          ok: false,
        };
      }

      if (response.status === 429) {
        const retryable = isRetryableRateLimitResponse(
          responseBody.parsedJson,
          responseBody.text,
          response.headers,
        );

        if (retryable) {
          if (attempt === CATALOG_RETRY_ATTEMPTS) {
            return {
              attempts: attempt,
              failure: createCatalogRetryFailure(response.status),
              ok: false,
            };
          }

          await waitBeforeRetry(attempt, dependencies);
          continue;
        }

        return {
          attempts: attempt,
          failure: createCatalogAuthFailure(response.status, "quota_or_access"),
          ok: false,
        };
      }

      if (response.status >= 500) {
        if (attempt === CATALOG_RETRY_ATTEMPTS) {
          return {
            attempts: attempt,
            failure: createCatalogRetryFailure(response.status),
            ok: false,
          };
        }

        await waitBeforeRetry(attempt, dependencies);
        continue;
      }

      if (!response.ok) {
        return {
          attempts: attempt,
          failure: createCatalogAuthFailure(response.status, "access_denied"),
          ok: false,
        };
      }

      const catalog = extractLiveCatalog(responseBody.parsedJson);

      if (catalog === undefined) {
        return {
          attempts: attempt,
          failure: createOnboardFailure("catalog_response_invalid", {
            details: {
              attempt,
              reason: "invalid_models_payload",
            },
            guidance:
              "Retry later or contact GonkaGate support if the live catalog keeps returning an unusable payload.",
            message:
              "GonkaGate returned an unusable live model catalog response before any files were changed.",
          }),
          ok: false,
        };
      }

      return {
        attempts: attempt,
        catalog,
        ok: true,
      };
    } catch {
      if (attempt === CATALOG_RETRY_ATTEMPTS) {
        return {
          attempts: attempt,
          failure: createCatalogRetryFailure(),
          ok: false,
        };
      }

      await waitBeforeRetry(attempt, dependencies);
    }
  }

  return {
    attempts: CATALOG_RETRY_ATTEMPTS,
    failure: createCatalogRetryFailure(),
    ok: false,
  };
}

function extractLiveCatalog(
  payload: unknown,
): LiveGonkaGateCatalog | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return undefined;
  }

  const dedupedModelIds: string[] = [];
  const seenModelIds = new Set<string>();

  for (const entry of payload.data) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      entry.id.trim() === ""
    ) {
      return undefined;
    }

    const modelId = entry.id.trim();

    if (seenModelIds.has(modelId)) {
      continue;
    }

    seenModelIds.add(modelId);
    dedupedModelIds.push(modelId);
  }

  if (dedupedModelIds.length === 0) {
    return undefined;
  }

  return {
    modelIds: Object.freeze(dedupedModelIds),
  };
}

function createCatalogAuthFailure(
  statusCode: number,
  reason: "access_denied" | "invalid_api_key" | "quota_or_access",
): OnboardFailure {
  const guidance =
    reason === "quota_or_access"
      ? "Check the GonkaGate API key and account or billing state, then rerun the helper."
      : "Check that the GonkaGate API key is valid and has access to the live catalog, then rerun the helper.";

  return createOnboardFailure("catalog_auth_failed", {
    details: {
      reason,
      statusCode,
    },
    guidance,
    message:
      "GonkaGate rejected the live model catalog request before any Hermes files were changed.",
  });
}

function createCatalogRetryFailure(statusCode?: number): OnboardFailure {
  return createOnboardFailure("catalog_retry_exhausted", {
    details: {
      attempts: CATALOG_RETRY_ATTEMPTS,
      ...(statusCode === undefined ? {} : { statusCode }),
    },
    guidance:
      "Retry later after the GonkaGate catalog is reachable again, then rerun the helper.",
    message:
      "The helper exhausted the bounded retry budget while fetching the live GonkaGate model catalog.",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function waitBeforeRetry(
  attempt: number,
  dependencies: Pick<OnboardDependencies, "sleep">,
): Promise<void> {
  const backoffMs = CATALOG_RETRY_BACKOFF_MS[attempt - 1];

  if (backoffMs !== undefined) {
    await dependencies.sleep(backoffMs);
  }
}
