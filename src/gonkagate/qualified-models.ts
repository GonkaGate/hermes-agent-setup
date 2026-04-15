import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  CONTRACT_METADATA,
  PINNED_HERMES_RELEASE_TAG,
} from "../constants/contract.js";
import type { LiveGonkaGateCatalog } from "../domain/catalog.js";
import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

const QUALIFICATION_ARTIFACTS_ROOT = fileURLToPath(
  new URL(
    `../../${CONTRACT_METADATA.launchQualificationArtifactRoot}/${PINNED_HERMES_RELEASE_TAG}/`,
    import.meta.url,
  ),
);
const MARKDOWN_EXTENSION = ".md";
const REQUIRED_ARTIFACT_HEADINGS = [
  "## Sanitized Config Shape",
  "## Sanitized Env Shape",
  "## Basic Text Turn",
  "## Streaming Turn",
  "## Harmless Tool-Use Turn",
] as const;

export interface QualifiedModelArtifact {
  artifactPath: string;
  hermesCommit: string;
  hermesReleaseTag: string;
  modelId: string;
  osCoverage: readonly string[];
  qualifiedOn: string;
  recommended: boolean;
  slug: string;
}

export interface QualifiedLiveModel extends QualifiedModelArtifact {}

export interface LoadQualifiedModelArtifactsResult {
  artifacts: readonly QualifiedModelArtifact[];
}

export interface QualifiedModelsLoaderOptions {
  artifactsRoot?: string;
}

export type QualifiedLiveModelsResult =
  | {
      ok: true;
      result: {
        artifacts: readonly QualifiedModelArtifact[];
        qualifiedLiveModels: readonly QualifiedLiveModel[];
      };
    }
  | {
      failure: OnboardFailure;
      ok: false;
    };

export async function loadQualifiedModelArtifacts(
  dependencies: Pick<OnboardDependencies, "fs">,
  options: QualifiedModelsLoaderOptions = {},
): Promise<
  | {
      ok: true;
      result: LoadQualifiedModelArtifactsResult;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  let directoryEntries: string[];
  const artifactsRoot = options.artifactsRoot ?? QUALIFICATION_ARTIFACTS_ROOT;

  try {
    directoryEntries = await dependencies.fs.readdir(artifactsRoot);
  } catch {
    return {
      failure: createQualifiedModelsFailure("artifact_root_unreadable"),
      ok: false,
    };
  }

  const artifactPaths = directoryEntries
    .filter(
      (entry) =>
        entry.endsWith(MARKDOWN_EXTENSION) &&
        entry.toLowerCase() !== "readme.md",
    )
    .sort()
    .map((entry) => join(artifactsRoot, entry));

  if (artifactPaths.length === 0) {
    return {
      failure: createQualifiedModelsFailure("artifact_missing"),
      ok: false,
    };
  }

  const artifacts: QualifiedModelArtifact[] = [];
  const seenModelIds = new Set<string>();
  let recommendedCount = 0;

  for (const artifactPath of artifactPaths) {
    const loadedArtifact = await loadArtifact(artifactPath, dependencies);

    if (!loadedArtifact.ok) {
      return loadedArtifact;
    }

    if (seenModelIds.has(loadedArtifact.result.modelId)) {
      return {
        failure: createQualifiedModelsFailure("duplicate_model_id", {
          modelId: loadedArtifact.result.modelId,
        }),
        ok: false,
      };
    }

    seenModelIds.add(loadedArtifact.result.modelId);
    recommendedCount += loadedArtifact.result.recommended ? 1 : 0;
    artifacts.push(loadedArtifact.result);
  }

  if (recommendedCount > 1) {
    return {
      failure: createQualifiedModelsFailure("multiple_recommended_models"),
      ok: false,
    };
  }

  return {
    ok: true,
    result: {
      artifacts: Object.freeze(artifacts),
    },
  };
}

export async function loadQualifiedLiveModels(
  catalog: LiveGonkaGateCatalog,
  dependencies: Pick<OnboardDependencies, "fs">,
  options: QualifiedModelsLoaderOptions = {},
): Promise<QualifiedLiveModelsResult> {
  const artifactsResult = await loadQualifiedModelArtifacts(
    dependencies,
    options,
  );

  if (!artifactsResult.ok) {
    return artifactsResult;
  }

  const liveModelIds = new Set(catalog.modelIds);
  const qualifiedLiveModels = artifactsResult.result.artifacts
    .filter((artifact) => liveModelIds.has(artifact.modelId))
    .sort((left, right) => left.modelId.localeCompare(right.modelId));

  if (qualifiedLiveModels.length === 0) {
    return {
      failure: createQualifiedModelsFailure("empty_live_intersection"),
      ok: false,
    };
  }

  return {
    ok: true,
    result: {
      artifacts: artifactsResult.result.artifacts,
      qualifiedLiveModels: Object.freeze(qualifiedLiveModels),
    },
  };
}

function createQualifiedModelsFailure(
  reason:
    | "artifact_missing"
    | "artifact_root_unreadable"
    | "duplicate_model_id"
    | "empty_live_intersection"
    | "invalid_artifact"
    | "multiple_recommended_models",
  details: Record<string, string> = {},
): OnboardFailure {
  return createOnboardFailure("qualified_models_unavailable", {
    details: {
      reason,
      ...details,
    },
    guidance:
      "Check the checked-in Hermes launch qualification artifacts and the live GonkaGate catalog, then rerun the helper.",
    message:
      "The helper could not resolve a qualified live GonkaGate model before any Hermes files were changed.",
  });
}

async function loadArtifact(
  artifactPath: string,
  dependencies: Pick<OnboardDependencies, "fs">,
): Promise<
  | {
      ok: true;
      result: QualifiedModelArtifact;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  let sourceText: string;

  try {
    sourceText = await dependencies.fs.readFile(artifactPath, "utf8");
  } catch {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "read_failed",
      }),
      ok: false,
    };
  }

  const parsedArtifact = parseArtifactFrontMatter(artifactPath, sourceText);

  if (!parsedArtifact.ok) {
    return {
      failure: parsedArtifact.failure,
      ok: false,
    };
  }

  return parsedArtifact;
}

function parseArtifactFrontMatter(
  artifactPath: string,
  sourceText: string,
):
  | {
      ok: true;
      result: QualifiedModelArtifact;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    } {
  const frontMatterMatch = sourceText.match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u,
  );

  if (frontMatterMatch === null) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "missing_front_matter",
      }),
      ok: false,
    };
  }

  const [, frontMatterText = ""] = frontMatterMatch;
  const bodyText = sourceText.slice(frontMatterMatch[0].length);
  let parsedFrontMatter: unknown;

  try {
    parsedFrontMatter = YAML.parse(frontMatterText);
  } catch {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "invalid_front_matter_yaml",
      }),
      ok: false,
    };
  }

  if (!isRecord(parsedFrontMatter)) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "front_matter_not_object",
      }),
      ok: false,
    };
  }

  const modelId = readRequiredString(parsedFrontMatter.modelId);
  const qualifiedOn = readRequiredString(parsedFrontMatter.qualifiedOn);
  const hermesReleaseTag = readRequiredString(
    parsedFrontMatter.hermesReleaseTag,
  );
  const hermesCommit = readRequiredString(parsedFrontMatter.hermesCommit);
  const recommended = parsedFrontMatter.recommended;
  const osCoverage = readStringArray(parsedFrontMatter.osCoverage);

  if (
    modelId === undefined ||
    qualifiedOn === undefined ||
    hermesReleaseTag === undefined ||
    hermesCommit === undefined ||
    typeof recommended !== "boolean" ||
    osCoverage === undefined
  ) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "missing_required_fields",
      }),
      ok: false,
    };
  }

  if (hermesReleaseTag !== PINNED_HERMES_RELEASE_TAG) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "pinned_release_mismatch",
      }),
      ok: false,
    };
  }

  const slug = basename(artifactPath, MARKDOWN_EXTENSION);

  if (slug !== slugifyModelId(modelId)) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "slug_mismatch",
      }),
      ok: false,
    };
  }

  if (
    REQUIRED_ARTIFACT_HEADINGS.some((heading) => !bodyText.includes(heading))
  ) {
    return {
      failure: createQualifiedModelsFailure("invalid_artifact", {
        artifactPath,
        reason: "missing_required_sections",
      }),
      ok: false,
    };
  }

  return {
    ok: true,
    result: {
      artifactPath,
      hermesCommit,
      hermesReleaseTag,
      modelId,
      osCoverage: Object.freeze(osCoverage),
      qualifiedOn,
      recommended,
      slug,
    },
  };
}

function slugifyModelId(modelId: string): string {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalizedValues.length === value.length && normalizedValues.length > 0
    ? normalizedValues
    : undefined;
}
