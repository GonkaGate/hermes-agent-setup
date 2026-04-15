import assert from "node:assert/strict";
import type {
  OnboardCliOptions,
  ResolvedHermesContext,
} from "../../src/domain/runtime.js";
import { resolveHermesContext } from "../../src/hermes/path-resolution.js";
import { loadNormalizedHermesRead } from "../../src/hermes/normalized-read.js";
import { loadPreWriteReviewPlanForContext } from "../../src/planning/review-plan-builder.js";
import type { CreateNodeOnboardDependenciesOverrides } from "../../src/runtime/dependencies.js";
import type { HermesIntegrationHarness } from "./harness.js";

export async function resolveFixtureContext(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
  } = {},
): Promise<{
  context: ResolvedHermesContext;
  dependencies: ReturnType<HermesIntegrationHarness["createDependencies"]>;
}> {
  const dependencies = harness.createDependencies(options.dependencyOverrides);
  const result = await resolveHermesContext(
    options.cliOptions ?? {},
    dependencies,
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error("Failed to resolve Hermes fixture context.");
  }

  return {
    context: result.context,
    dependencies,
  };
}

export async function loadNormalizedReadForFixture(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
  } = {},
) {
  const { context, dependencies } = await resolveFixtureContext(
    harness,
    options,
  );

  return await loadNormalizedHermesRead(context, dependencies);
}

export async function loadReviewPlanForFixture(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
  } = {},
) {
  const { context, dependencies } = await resolveFixtureContext(
    harness,
    options,
  );

  return await loadPreWriteReviewPlanForContext(context, dependencies);
}
