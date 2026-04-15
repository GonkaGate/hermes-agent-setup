import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
);
const defaultArtifactsRoot = resolve(
  repoRoot,
  "docs",
  "launch-qualification",
  "hermes-agent-setup",
);
const REQUIRED_HEADINGS = [
  "## Sanitized Config Shape",
  "## Sanitized Env Shape",
  "## Basic Text Turn",
  "## Streaming Turn",
  "## Harmless Tool-Use Turn",
];

function printHelp() {
  console.log(`Validate checked-in launch qualification artifacts.

Usage:
  node scripts/launch-qualification/validate-artifacts.mjs [--root <path>]

Default root:
  docs/launch-qualification/hermes-agent-setup
`);
}

function slugifyModelId(modelId) {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function walkMarkdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(fullPath)));
      continue;
    }

    if (
      entry.isFile() &&
      extname(entry.name).toLowerCase() === ".md" &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function readRequiredString(value, label, artifactPath) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${artifactPath}: missing required ${label}.`);
  }

  return value.trim();
}

function readStringArray(value, label, artifactPath) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${artifactPath}: missing required ${label}.`);
  }

  const normalized = value.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${artifactPath}: invalid ${label} entry.`);
    }

    return entry.trim();
  });

  return normalized;
}

function validateArtifactDocument(artifactPath, sourceText, pinnedReleaseTag) {
  const frontMatterMatch = sourceText.match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u,
  );

  if (frontMatterMatch === null) {
    throw new Error(`${artifactPath}: missing front matter.`);
  }

  const bodyText = sourceText.slice(frontMatterMatch[0].length);
  let parsedFrontMatter;

  try {
    parsedFrontMatter = YAML.parse(frontMatterMatch[1] ?? "");
  } catch (error) {
    throw new Error(
      `${artifactPath}: invalid front matter YAML (${error instanceof Error ? error.message : String(error)}).`,
    );
  }

  if (!isRecord(parsedFrontMatter)) {
    throw new Error(`${artifactPath}: front matter must parse to an object.`);
  }

  const modelId = readRequiredString(
    parsedFrontMatter.modelId,
    "modelId",
    artifactPath,
  );
  const qualifiedOn = readRequiredString(
    parsedFrontMatter.qualifiedOn,
    "qualifiedOn",
    artifactPath,
  );
  const hermesReleaseTag = readRequiredString(
    parsedFrontMatter.hermesReleaseTag,
    "hermesReleaseTag",
    artifactPath,
  );
  const hermesCommit = readRequiredString(
    parsedFrontMatter.hermesCommit,
    "hermesCommit",
    artifactPath,
  );
  const osCoverage = readStringArray(
    parsedFrontMatter.osCoverage,
    "osCoverage",
    artifactPath,
  );

  if (typeof parsedFrontMatter.recommended !== "boolean") {
    throw new Error(`${artifactPath}: recommended must be a boolean.`);
  }

  if (hermesReleaseTag !== pinnedReleaseTag) {
    throw new Error(
      `${artifactPath}: expected hermesReleaseTag ${pinnedReleaseTag}, received ${hermesReleaseTag}.`,
    );
  }

  const slug = basename(artifactPath, ".md");

  if (slug !== slugifyModelId(modelId)) {
    throw new Error(
      `${artifactPath}: filename slug ${slug} does not match modelId ${modelId}.`,
    );
  }

  if (REQUIRED_HEADINGS.some((heading) => !bodyText.includes(heading))) {
    throw new Error(
      `${artifactPath}: missing one or more required body sections.`,
    );
  }

  return {
    hermesCommit,
    hermesReleaseTag,
    modelId,
    osCoverage,
    qualifiedOn,
    recommended: parsedFrontMatter.recommended,
  };
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

async function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      help: {
        short: "h",
        type: "boolean",
      },
      root: {
        type: "string",
      },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const constants = await loadBuiltConstants();
  const root = resolve(
    typeof values.root === "string" && values.root.trim().length > 0
      ? values.root
      : defaultArtifactsRoot,
  );
  const artifactPaths = await walkMarkdownFiles(root);

  if (artifactPaths.length === 0) {
    throw new Error(`No launch qualification artifacts found under ${root}.`);
  }

  const seenByRelease = new Map();
  const recommendedCountByRelease = new Map();

  for (const artifactPath of artifactPaths) {
    const sourceText = await readFile(artifactPath, "utf8");
    const artifact = validateArtifactDocument(
      artifactPath,
      sourceText,
      constants.PINNED_HERMES_RELEASE_TAG,
    );
    const duplicateKey = `${artifact.hermesReleaseTag}:${artifact.modelId}`;

    if (seenByRelease.has(duplicateKey)) {
      throw new Error(
        `${artifactPath}: duplicate modelId ${artifact.modelId} for ${artifact.hermesReleaseTag}.`,
      );
    }

    seenByRelease.set(duplicateKey, artifactPath);

    const recommendedCount =
      (recommendedCountByRelease.get(artifact.hermesReleaseTag) ?? 0) +
      (artifact.recommended ? 1 : 0);

    recommendedCountByRelease.set(artifact.hermesReleaseTag, recommendedCount);

    if (recommendedCount > 1) {
      throw new Error(
        `${artifactPath}: more than one recommended artifact found for ${artifact.hermesReleaseTag}.`,
      );
    }
  }

  console.log(
    `Validated ${artifactPaths.length} launch qualification artifact(s) under ${root}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
