import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";

declare const validatedApiKeyBrand: unique symbol;

export type ValidatedApiKey = string & {
  readonly [validatedApiKeyBrand]: "ValidatedApiKey";
};

export type ApiKeyValidationResult =
  | {
      apiKey: ValidatedApiKey;
      ok: true;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    };

export function validateGonkaGateApiKey(
  rawValue: string,
): ApiKeyValidationResult {
  const normalizedValue = rawValue.trim();

  if (!/^gp-\S+$/u.test(normalizedValue)) {
    return {
      failure: createOnboardFailure("api_key_invalid", {
        guidance:
          "Enter a GonkaGate API key that starts with `gp-`, then rerun the helper.",
        message:
          "The provided GonkaGate API key is invalid. Expected a non-empty key that starts with `gp-`.",
      }),
      ok: false,
    };
  }

  return {
    apiKey: normalizedValue as ValidatedApiKey,
    ok: true,
  };
}
