import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import {
  validateGonkaGateApiKey,
  type ValidatedApiKey,
} from "../validation/api-key.js";

const SECRET_PROMPT_MESSAGE = "Enter your GonkaGate API key";

export interface PromptForApiKeyResult {
  apiKey: ValidatedApiKey;
}

export function canUseInteractivePrompts(
  dependencies: Pick<OnboardDependencies, "runtime">,
): boolean {
  return dependencies.runtime.stdinIsTTY && dependencies.runtime.stdoutIsTTY;
}

export async function promptForValidatedApiKey(
  dependencies: OnboardDependencies,
): Promise<
  | {
      ok: true;
      result: PromptForApiKeyResult;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  if (!canUseInteractivePrompts(dependencies)) {
    return {
      failure: createOnboardFailure("missing_tty", {
        guidance:
          "Run the helper in an interactive terminal before the hidden API key prompt phase begins.",
        message: "A TTY is required for the hidden GonkaGate API key prompt.",
      }),
      ok: false,
    };
  }

  const promptedValue = await dependencies.prompts.readSecret(
    SECRET_PROMPT_MESSAGE,
  );
  const validationResult = validateGonkaGateApiKey(promptedValue);

  if (!validationResult.ok) {
    return validationResult;
  }

  return {
    ok: true,
    result: {
      apiKey: validationResult.apiKey,
    },
  };
}
