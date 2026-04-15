import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type { PhaseFourReview } from "../domain/writes.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import { canUseInteractivePrompts } from "../ui/prompts.js";

export async function confirmPhaseFourReview(
  review: PhaseFourReview,
  dependencies: OnboardDependencies,
): Promise<
  | {
      confirmed: boolean;
      ok: true;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  if (!review.confirmationRequired) {
    return {
      confirmed: true,
      ok: true,
    };
  }

  if (!canUseInteractivePrompts(dependencies)) {
    return {
      failure: createOnboardFailure("missing_tty", {
        guidance:
          "Run the helper in an interactive terminal before confirming the planned GonkaGate config changes.",
        message:
          "A TTY is required to confirm the planned GonkaGate onboarding changes.",
      }),
      ok: false,
    };
  }

  const selection = await dependencies.prompts.selectOption({
    choices: [
      {
        description: "Apply the planned config and env changes.",
        label: "Continue",
        value: "continue",
      },
      {
        description: "Exit without touching any Hermes files.",
        label: "Cancel",
        value: "cancel",
      },
    ],
    defaultValue: "continue",
    message: review.promptMessage,
  });

  return {
    confirmed: selection === "continue",
    ok: true,
  };
}
