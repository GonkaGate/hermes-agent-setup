import { CANONICAL_BASE_URL } from "../constants/contract.js";

export interface ParsedHttpResponseBody {
  parsedJson: unknown | undefined;
  text: string;
}

export function buildGonkaGateModelsUrl(): string {
  return `${CANONICAL_BASE_URL}/models`;
}

export async function parseHttpResponseBody(
  response: Response,
): Promise<ParsedHttpResponseBody> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {
      parsedJson: undefined,
      text,
    };
  }

  try {
    return {
      parsedJson: JSON.parse(text) as unknown,
      text,
    };
  } catch {
    return {
      parsedJson: undefined,
      text,
    };
  }
}

export function isRetryableRateLimitResponse(
  parsedJson: unknown,
  text: string,
  headers: Headers,
): boolean {
  const combinedSignal = [
    ...collectErrorSignals(parsedJson),
    text,
    headers.get("retry-after") ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    combinedSignal.includes("insufficient_quota") ||
    combinedSignal.includes("quota") ||
    combinedSignal.includes("billing")
  ) {
    return false;
  }

  return (
    combinedSignal.includes("rate_limit") ||
    combinedSignal.includes("rate limit") ||
    (headers.get("retry-after") ?? "").trim().length > 0
  );
}

function collectErrorSignals(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const error = isRecord(value.error) ? value.error : undefined;

  return [
    asString(error?.type),
    asString(error?.code),
    asString(error?.message),
    asString(value.type),
    asString(value.code),
    asString(value.message),
  ].filter((entry) => entry.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
