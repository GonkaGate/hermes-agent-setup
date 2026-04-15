import { Command, Option } from "commander";
import { CONTRACT_METADATA } from "../constants/contract.js";
import type { OnboardCliOptions } from "../domain/runtime.js";
import type { ProgramOutput } from "./contracts.js";

interface ParsedProgramOptions {
  profile?: string;
}

function createProgram(output?: ProgramOutput): Command {
  const program = new Command()
    .name(CONTRACT_METADATA.binName)
    .description(CONTRACT_METADATA.packageDescription)
    .addOption(
      new Option(
        "--profile <name>",
        "Resolve Hermes config paths through the named Hermes profile.",
      ),
    )
    .helpOption("-h, --help", "Show this help.")
    .version(
      CONTRACT_METADATA.cliVersion,
      "-v, --version",
      "Show the package version.",
    )
    .addHelpText(
      "after",
      `
Examples:
  ${CONTRACT_METADATA.publicEntrypoint}
  ${CONTRACT_METADATA.publicEntrypoint} --profile work

Current state:
  - ${CONTRACT_METADATA.runtimePublicState}
  - Canonical base URL: ${CONTRACT_METADATA.canonicalBaseUrl}
  - Supported launch platforms: Linux, macOS, and WSL2
  - Helper-managed config keys: ${CONTRACT_METADATA.helperManagedConfigKeys.join(", ")}
  - Helper-managed secret keys: ${CONTRACT_METADATA.helperManagedSecretEnvKeys.join(", ")}
  - Launch qualification artifacts: ${CONTRACT_METADATA.launchQualificationArtifactRoot}/${CONTRACT_METADATA.pinnedHermesReleaseTag}
`,
    )
    .exitOverride();

  if (output !== undefined) {
    program.configureOutput(output);
  }

  return program;
}

export function parseCliOptions(
  argv: string[],
  output?: ProgramOutput,
): OnboardCliOptions {
  const program = createProgram(output);
  program.parse(["node", CONTRACT_METADATA.binName, ...argv]);

  const options = program.opts<ParsedProgramOptions>();

  return {
    profile: options.profile,
  };
}
