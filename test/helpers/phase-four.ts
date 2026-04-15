import assert from "node:assert/strict";
import {
  buildPhaseFourWritePlan,
  executePhaseFourWritePlan,
} from "../../src/commands/phase-four.js";
import type { OnboardCliOptions } from "../../src/domain/runtime.js";
import type { CreateNodeOnboardDependenciesOverrides } from "../../src/runtime/dependencies.js";
import type { ExecuteWritePlanOptions } from "../../src/writes/execute-plan.js";
import type { HermesIntegrationHarness } from "./harness.js";
import { preparePhaseThreeSelectionForFixture } from "./phase-three.js";

export async function buildPhaseFourWritePlanForFixture(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
    qualificationArtifactsRoot?: string;
  } = {},
) {
  const phaseThreeResult = await preparePhaseThreeSelectionForFixture(harness, {
    cliOptions: options.cliOptions,
    dependencyOverrides: options.dependencyOverrides,
    qualificationArtifactsRoot: options.qualificationArtifactsRoot,
  });

  assert.equal(phaseThreeResult.ok, true);

  if (!phaseThreeResult.ok) {
    throw new Error("Failed to prepare phase-three selection for phase four.");
  }

  return buildPhaseFourWritePlan(phaseThreeResult.result);
}

export async function executePhaseFourWritePlanForFixture(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
    executionOptions?: ExecuteWritePlanOptions;
    qualificationArtifactsRoot?: string;
  } = {},
) {
  const writePlanResult = await buildPhaseFourWritePlanForFixture(harness, {
    cliOptions: options.cliOptions,
    dependencyOverrides: options.dependencyOverrides,
    qualificationArtifactsRoot: options.qualificationArtifactsRoot,
  });

  assert.equal(writePlanResult.ok, true);

  if (!writePlanResult.ok) {
    throw new Error("Failed to build a phase-four write plan for the fixture.");
  }

  return await executePhaseFourWritePlan(
    writePlanResult.result,
    harness.createDependencies(options.dependencyOverrides),
    options.executionOptions,
  );
}
