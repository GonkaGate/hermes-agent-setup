export function canonicalizeBaseUrl(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const pathname =
      parsedUrl.pathname === "/" ? "" : parsedUrl.pathname.replace(/\/+$/u, "");

    return `${parsedUrl.protocol.toLowerCase()}//${parsedUrl.host.toLowerCase()}${pathname}`;
  } catch {
    return trimmedValue.replace(/\/+$/u, "");
  }
}

export function normalizeProviderName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function normalizeStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "1";
  }

  return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRecordAtPath(
  value: unknown,
  path: readonly string[],
): Record<string, unknown> | undefined {
  let currentValue: unknown = value;

  for (const segment of path) {
    if (!isRecord(currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return isRecord(currentValue) ? currentValue : undefined;
}

export function getStringAtPath(
  value: unknown,
  path: readonly string[],
): string {
  let currentValue: unknown = value;

  for (const segment of path) {
    if (!isRecord(currentValue)) {
      return "";
    }

    currentValue = currentValue[segment];
  }

  return normalizeStringValue(currentValue);
}

export function getBooleanAtPath(
  value: unknown,
  path: readonly string[],
): boolean {
  let currentValue: unknown = value;

  for (const segment of path) {
    if (!isRecord(currentValue)) {
      return false;
    }

    currentValue = currentValue[segment];
  }

  return normalizeBooleanValue(currentValue);
}
