import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

function printHelp() {
  console.log(`Build a checked-in launch qualification artifact.

Usage:
  node scripts/launch-qualification/build-artifact.mjs --session-dir <dir> --hermes-commit <sha> [--qualified-on <YYYY-MM-DD>] [--os linux,macos,wsl2] [--recommended]
  node scripts/launch-qualification/build-artifact.mjs --model-id <id> --hermes-commit <sha> --config <path> --env <path> --basic-log <path> --stream-log <path> --tool-log <path> --out <path>

Defaults:
  --qualified-on        today's UTC date
  --hermes-release-tag  the pinned release from src/constants/contract.ts
  --os                  linux,macos,wsl2

When --session-dir is provided, the script reads:
  sanitized-config.yaml
  sanitized-env.env
  transcripts/basic-text.txt
  transcripts/streaming.txt
  transcripts/tool-use.txt
  session-summary.json
`);
}

function slugifyModelId(modelId) {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function redactSensitiveText(text) {
  return text
    .replace(/Bearer\s+[^\s]+/giu, "Bearer [REDACTED]")
    .replace(/\bgp-[A-Za-z0-9._-]+\b/gu, "[REDACTED]")
    .replace(/(OPENAI_API_KEY=).+/gu, "$1[REDACTED]");
}

function readRequiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required ${label}.`);
  }

  return value.trim();
}

function normalizeOsCoverage(value) {
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (parsed.length === 0) {
    throw new Error("Expected at least one OS entry in --os.");
  }

  return parsed;
}

async function loadBuiltConstants() {
  try {
    return await import("../../dist/constants/contract.js");
  } catch (error) {
    console.error(
      "This script needs the built runtime. Run `npm run build` first or use the package scripts.",
    );
    throw error;
  }
}

async function resolveSessionDefaults(sessionDir) {
  const summaryPath = join(sessionDir, "session-summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));

  return {
    basicLog: join(sessionDir, "transcripts", "basic-text.txt"),
    config: join(sessionDir, "sanitized-config.yaml"),
    env: join(sessionDir, "sanitized-env.env"),
    modelId: summary.selectedModelId,
    out: summary.artifactSuggestedPath,
    streamLog: join(sessionDir, "transcripts", "streaming.txt"),
    toolLog: join(sessionDir, "transcripts", "tool-use.txt"),
  };
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      "basic-log": {
        type: "string",
      },
      config: {
        type: "string",
      },
      env: {
        type: "string",
      },
      help: {
        short: "h",
        type: "boolean",
      },
      "hermes-commit": {
        type: "string",
      },
      "hermes-release-tag": {
        type: "string",
      },
      "model-id": {
        type: "string",
      },
      os: {
        type: "string",
      },
      out: {
        type: "string",
      },
      "qualified-on": {
        type: "string",
      },
      recommended: {
        type: "boolean",
      },
      "session-dir": {
        type: "string",
      },
      "stream-log": {
        type: "string",
      },
      "tool-log": {
        type: "string",
      },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const constants = await loadBuiltConstants();
  const sessionDefaults =
    typeof values["session-dir"] === "string" &&
    values["session-dir"].trim().length > 0
      ? await resolveSessionDefaults(resolve(values["session-dir"]))
      : {};

  const modelId = readRequiredString(
    values["model-id"] ?? sessionDefaults.modelId,
    "--model-id",
  );
  const hermesCommit = readRequiredString(
    values["hermes-commit"],
    "--hermes-commit",
  );
  const qualifiedOn =
    typeof values["qualified-on"] === "string" &&
    values["qualified-on"].trim().length > 0
      ? values["qualified-on"].trim()
      : new Date().toISOString().slice(0, 10);
  const hermesReleaseTag =
    typeof values["hermes-release-tag"] === "string" &&
    values["hermes-release-tag"].trim().length > 0
      ? values["hermes-release-tag"].trim()
      : constants.PINNED_HERMES_RELEASE_TAG;
  const osCoverage = normalizeOsCoverage(
    typeof values.os === "string" && values.os.trim().length > 0
      ? values.os
      : "linux,macos,wsl2",
  );
  const configPath = resolve(
    readRequiredString(values.config ?? sessionDefaults.config, "--config"),
  );
  const envPath = resolve(
    readRequiredString(values.env ?? sessionDefaults.env, "--env"),
  );
  const basicLogPath = resolve(
    readRequiredString(
      values["basic-log"] ?? sessionDefaults.basicLog,
      "--basic-log",
    ),
  );
  const streamLogPath = resolve(
    readRequiredString(
      values["stream-log"] ?? sessionDefaults.streamLog,
      "--stream-log",
    ),
  );
  const toolLogPath = resolve(
    readRequiredString(
      values["tool-log"] ?? sessionDefaults.toolLog,
      "--tool-log",
    ),
  );
  const outPath = resolve(
    readRequiredString(values.out ?? sessionDefaults.out, "--out"),
  );
  const slug = slugifyModelId(modelId);

  if (!outPath.endsWith(`${slug}.md`)) {
    throw new Error(
      `Output filename must match the model slug ${slug}.md for ${modelId}.`,
    );
  }

  const [
    configContents,
    envContents,
    basicLogContents,
    streamLogContents,
    toolLogContents,
  ] = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(envPath, "utf8"),
    readFile(basicLogPath, "utf8"),
    readFile(streamLogPath, "utf8"),
    readFile(toolLogPath, "utf8"),
  ]);

  const frontMatter = YAML.stringify({
    hermesCommit,
    hermesReleaseTag,
    modelId,
    osCoverage,
    qualifiedOn,
    recommended: values.recommended ?? false,
  }).trim();
  const artifactBody = [
    "---",
    frontMatter,
    "---",
    "",
    `# \`${modelId}\``,
    "",
    "## Sanitized Config Shape",
    "",
    "```yaml",
    redactSensitiveText(configContents).trim(),
    "```",
    "",
    "## Sanitized Env Shape",
    "",
    "```dotenv",
    redactSensitiveText(envContents).trim(),
    "```",
    "",
    "## Basic Text Turn",
    "",
    "Saved transcript excerpt from the clean-home Hermes qualification run:",
    "",
    "```text",
    redactSensitiveText(basicLogContents).trim(),
    "```",
    "",
    "## Streaming Turn",
    "",
    "Saved transcript excerpt from the clean-home Hermes streaming qualification run:",
    "",
    "```text",
    redactSensitiveText(streamLogContents).trim(),
    "```",
    "",
    "## Harmless Tool-Use Turn",
    "",
    "Saved transcript excerpt from the clean-home Hermes tool-use qualification run:",
    "",
    "```text",
    redactSensitiveText(toolLogContents).trim(),
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, artifactBody, "utf8");
  console.log(`Wrote launch qualification artifact: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
