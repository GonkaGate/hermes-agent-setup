const REDACTED_VALUE = "[REDACTED]";
const SECRET_TEXT_PATTERNS = [
  /\bgp-[A-Za-z0-9._-]+\b/gu,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gu,
];

export function redactSecretBearingText(text: string): string {
  let redacted = text;

  for (const pattern of SECRET_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED_VALUE);
  }

  return redacted;
}

export function redactUnknownErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return redactSecretBearingText(message);
}
