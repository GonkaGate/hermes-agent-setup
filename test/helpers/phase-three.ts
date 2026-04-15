import type { OnboardCliOptions } from "../../src/domain/runtime.js";
import { preparePhaseThreeSelection } from "../../src/commands/phase-three.js";
import type { CreateNodeOnboardDependenciesOverrides } from "../../src/runtime/dependencies.js";
import type { HermesIntegrationHarness } from "./harness.js";

export async function preparePhaseThreeSelectionForFixture(
  harness: HermesIntegrationHarness,
  options: {
    cliOptions?: OnboardCliOptions;
    dependencyOverrides?: CreateNodeOnboardDependenciesOverrides;
    qualificationArtifactsRoot?: string;
  } = {},
) {
  const dependencies = harness.createDependencies(options.dependencyOverrides);

  return await preparePhaseThreeSelection(
    options.cliOptions ?? {},
    dependencies,
    {
      qualificationArtifactsRoot: options.qualificationArtifactsRoot,
    },
  );
}
