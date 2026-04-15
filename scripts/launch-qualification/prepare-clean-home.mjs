import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const QUALIFICATION_PROMPTS = {
  basicText:
    'Reply with exactly "GonkaGate Hermes qualification text ok" and nothing else.',
  streaming:
    "Stream one short paragraph confirming that the helper-configured GonkaGate path is active, then stop.",
  toolUse:
    "Use one harmless local tool such as `pwd`, then summarize the result in one sentence.",
};

function printHelp() {
  console.log(`Prepare a clean Hermes home for launch qualification.

Usage:
  node scripts/launch-qualification/prepare-clean-home.mjs [--model <id>] [--profile <name>] [--output-dir <dir>]

Required environment:
  GONKAGATE_API_KEY   GonkaGate API key used for the helper run

What this script does:
  - creates a clean HERMES_HOME under a temporary or explicit output directory
  - runs the shipped onboarding flow programmatically
  - writes sanitized config and env snapshots plus the consolidated review text
  - writes the prompt contracts and transcript paths for basic text, streaming,
    and harmless tool-use qualification turns

Typical follow-up:
  1. Run the three Hermes smoke turns in the prepared HERMES_HOME.
  2. Save the transcript excerpts under transcripts/.
  3. Run scripts/launch-qualification/build-artifact.mjs to create the checked-in artifact.
`);
}

function createBufferWriter() {
  return {
    contents: "",
    write(text) {
      this.contents += text;
    },
  };
}

function redactSensitiveText(text) {
  return text
    .replace(/Bearer\s+[^\s]+/giu, "Bearer [REDACTED]")
    .replace(/\bgp-[A-Za-z0-9._-]+\b/gu, "[REDACTED]");
}

function slugifyModelId(modelId) {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

async function loadBuiltRuntime() {
  try {
    const [
      { runOnboardCommand },
      { createNodeOnboardDependencies },
      constants,
    ] = await Promise.all([
      import("../../dist/commands/onboard.js"),
      import("../../dist/runtime/dependencies.js"),
      import("../../dist/constants/contract.js"),
    ]);

    return {
      PINNED_HERMES_RELEASE_TAG: constants.PINNED_HERMES_RELEASE_TAG,
      launchQualificationArtifactRoot:
        constants.CONTRACT_METADATA.launchQualificationArtifactRoot,
      runOnboardCommand,
      createNodeOnboardDependencies,
    };
  } catch (error) {
    console.error(
      "This script needs the built runtime. Run `npm run build` first or use `npm run qualification:prepare`.",
    );
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      help: {
        short: "h",
        type: "boolean",
      },
      model: {
        type: "string",
      },
      "output-dir": {
        type: "string",
      },
      profile: {
        type: "string",
      },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const apiKey = (process.env.GONKAGATE_API_KEY ?? "").trim();

  if (apiKey.length === 0) {
    console.error(
      "Missing GONKAGATE_API_KEY. Export a real key before preparing launch qualification.",
    );
    process.exitCode = 1;
    return;
  }

  const {
    PINNED_HERMES_RELEASE_TAG,
    createNodeOnboardDependencies,
    launchQualificationArtifactRoot,
    runOnboardCommand,
  } = await loadBuiltRuntime();
  const outputRoot =
    typeof values["output-dir"] === "string"
      ? resolve(values["output-dir"])
      : await mkdtemp(join(tmpdir(), "hermes-launch-qualification-"));
  const hermesHomeDir = join(outputRoot, "hermes-home");
  const promptsDir = join(outputRoot, "prompts");
  const transcriptsDir = join(outputRoot, "transcripts");

  await Promise.all([
    mkdir(hermesHomeDir, { recursive: true }),
    mkdir(promptsDir, { recursive: true }),
    mkdir(transcriptsDir, { recursive: true }),
  ]);

  const reviewWriter = createBufferWriter();
  const requestedModelId =
    typeof values.model === "string" && values.model.trim().length > 0
      ? values.model.trim()
      : undefined;

  const dependencies = createNodeOnboardDependencies({
    prompts: {
      async readSecret() {
        return apiKey;
      },
      async selectOption(options) {
        const requestedChoice =
          requestedModelId === undefined
            ? undefined
            : options.choices.find(
                (choice) => choice.value === requestedModelId,
              )?.value;

        if (requestedChoice !== undefined) {
          return requestedChoice;
        }

        const continueChoice = options.choices.find(
          (choice) => choice.value === "continue",
        )?.value;

        if (continueChoice !== undefined) {
          return continueChoice;
        }

        return options.defaultValue ?? options.choices[0]?.value;
      },
    },
    runtime: {
      cwd: outputRoot,
      env: {
        ...process.env,
        HERMES_HOME: hermesHomeDir,
        HOME: outputRoot,
        XDG_CONFIG_HOME: join(outputRoot, ".xdg-config"),
        XDG_DATA_HOME: join(outputRoot, ".xdg-data"),
      },
      stdinIsTTY: true,
      stdoutIsTTY: true,
    },
  });

  const result = await runOnboardCommand(
    {
      profile:
        typeof values.profile === "string" && values.profile.trim().length > 0
          ? values.profile.trim()
          : undefined,
    },
    dependencies,
    reviewWriter,
  );

  if (result.status !== "success") {
    if (reviewWriter.contents.length > 0) {
      console.error(reviewWriter.contents);
    }

    console.error(result.message);
    process.exitCode = 1;
    return;
  }

  const [configContents, envContents] = await Promise.all([
    readFile(result.preflight.configPath, "utf8"),
    readFile(result.preflight.envPath, "utf8"),
  ]);
  const sanitizedConfigPath = join(outputRoot, "sanitized-config.yaml");
  const sanitizedEnvPath = join(outputRoot, "sanitized-env.env");
  const reviewPath = join(outputRoot, "review.txt");
  const sessionSummaryPath = join(outputRoot, "session-summary.json");
  const basicPromptPath = join(promptsDir, "basic-text.txt");
  const streamingPromptPath = join(promptsDir, "streaming.txt");
  const toolPromptPath = join(promptsDir, "tool-use.txt");
  const basicTranscriptPath = join(transcriptsDir, "basic-text.txt");
  const streamingTranscriptPath = join(transcriptsDir, "streaming.txt");
  const toolTranscriptPath = join(transcriptsDir, "tool-use.txt");
  const artifactSuggestedPath = resolve(
    repoRoot,
    launchQualificationArtifactRoot,
    PINNED_HERMES_RELEASE_TAG,
    `${slugifyModelId(result.selectedModelId)}.md`,
  );

  await Promise.all([
    writeFile(sanitizedConfigPath, redactSensitiveText(configContents), "utf8"),
    writeFile(sanitizedEnvPath, redactSensitiveText(envContents), "utf8"),
    writeFile(reviewPath, reviewWriter.contents, "utf8"),
    writeFile(basicPromptPath, `${QUALIFICATION_PROMPTS.basicText}\n`, "utf8"),
    writeFile(
      streamingPromptPath,
      `${QUALIFICATION_PROMPTS.streaming}\n`,
      "utf8",
    ),
    writeFile(toolPromptPath, `${QUALIFICATION_PROMPTS.toolUse}\n`, "utf8"),
    writeFile(
      sessionSummaryPath,
      JSON.stringify(
        {
          artifactSuggestedPath,
          basicTranscriptPath,
          hermesHomeDir,
          hermesReleaseTag: PINNED_HERMES_RELEASE_TAG,
          profile:
            typeof values.profile === "string" ? values.profile.trim() : null,
          prompts: QUALIFICATION_PROMPTS,
          reviewPath,
          sanitizedConfigPath,
          sanitizedEnvPath,
          selectedModelId: result.selectedModelId,
          streamingTranscriptPath,
          toolTranscriptPath,
        },
        null,
        2,
      ),
      "utf8",
    ),
  ]);

  console.log(`Prepared clean-home launch qualification under ${outputRoot}`);
  console.log(`Resolved HERMES_HOME: ${hermesHomeDir}`);
  console.log(`Selected model: ${result.selectedModelId}`);
  console.log(`Pinned Hermes release: ${PINNED_HERMES_RELEASE_TAG}`);
  console.log(`Sanitized config snapshot: ${sanitizedConfigPath}`);
  console.log(`Sanitized env snapshot: ${sanitizedEnvPath}`);
  console.log(`Review transcript: ${reviewPath}`);
  console.log("");
  console.log("Prompt files:");
  console.log(`- Basic text: ${basicPromptPath}`);
  console.log(`- Streaming: ${streamingPromptPath}`);
  console.log(`- Harmless tool use: ${toolPromptPath}`);
  console.log("");
  console.log("Save transcript excerpts to:");
  console.log(`- ${basicTranscriptPath}`);
  console.log(`- ${streamingTranscriptPath}`);
  console.log(`- ${toolTranscriptPath}`);
  console.log("");
  console.log(
    `Then build the checked-in artifact with scripts/launch-qualification/build-artifact.mjs and the suggested output ${artifactSuggestedPath}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
