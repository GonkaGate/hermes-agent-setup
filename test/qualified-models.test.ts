import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadQualifiedLiveModels,
  loadQualifiedModelArtifacts,
} from "../src/gonkagate/qualified-models.js";
import { createNodeOnboardDependencies } from "../src/runtime/dependencies.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const qualificationFixtureRoot = resolve(
  testDir,
  "fixtures",
  "launch-qualification",
);
const checkedInQualificationRoot = resolve(
  testDir,
  "..",
  "docs",
  "launch-qualification",
  "hermes-agent-setup",
  "v2026.5.16",
);

function createDependencies() {
  return createNodeOnboardDependencies();
}

function resolveQualificationFixture(name: string): string {
  return resolve(qualificationFixtureRoot, name);
}

test("qualified-model loader reads a valid checked-in artifact", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: resolveQualificationFixture("valid-single"),
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.artifacts.map((artifact) => artifact.modelId),
    ["qwen/qwen3-235b-a22b-instruct-2507-fp8"],
  );
  assert.equal(result.result.artifacts[0]?.hermesReleaseTag, "v2026.5.16");
});

test("checked-in launch artifacts carry no recommended-model flag", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies());

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  for (const artifact of result.result.artifacts) {
    assert.equal("recommended" in artifact, false);
  }
});

test("qualified-model loader rejects malformed front matter", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: resolveQualificationFixture("bad-front-matter"),
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "missing_front_matter");
});

test("qualified-model loader rejects slug mismatches", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: resolveQualificationFixture("slug-mismatch"),
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "slug_mismatch");
});

test("qualified-model loader rejects pinned release mismatches", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: resolveQualificationFixture("pinned-release-mismatch"),
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "pinned_release_mismatch");
});

test("live model loader exposes all live catalog models in returned order", () => {
  const result = loadQualifiedLiveModels({
    modelIds: ["qwen/qwen3-235b-a22b-instruct-2507-fp8", "alpha/model-a"],
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.qualifiedLiveModels.map((model) => model.modelId),
    ["qwen/qwen3-235b-a22b-instruct-2507-fp8", "alpha/model-a"],
  );
});

test("live model loader carries enriched catalog metadata through unchanged", () => {
  const result = loadQualifiedLiveModels({
    modelIds: ["deepseek-ai/deepseek-v4-flash-0731", "moonshotai/kimi-k2.6"],
    models: [
      {
        contextLength: 400000,
        description: "Fast agentic coding model.",
        displayName: "DeepSeek V4 Flash 0731",
        modelId: "deepseek-ai/deepseek-v4-flash-0731",
      },
      {
        modelId: "moonshotai/kimi-k2.6",
      },
    ],
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.result.qualifiedLiveModels, [
    {
      contextLength: 400000,
      description: "Fast agentic coding model.",
      displayName: "DeepSeek V4 Flash 0731",
      modelId: "deepseek-ai/deepseek-v4-flash-0731",
    },
    {
      contextLength: undefined,
      description: undefined,
      displayName: undefined,
      modelId: "moonshotai/kimi-k2.6",
    },
  ]);
});

test("live catalog models do not need checked-in qualification artifacts", () => {
  const result = loadQualifiedLiveModels({
    modelIds: [
      "qwen/qwen3-235b-a22b-instruct-2507-fp8",
      "unqualified/live-only-model",
    ],
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.qualifiedLiveModels.map((model) => model.modelId),
    ["qwen/qwen3-235b-a22b-instruct-2507-fp8", "unqualified/live-only-model"],
  );
});

test("checked-in launch artifacts remain readable as evidence", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: checkedInQualificationRoot,
  });

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.artifacts.map((artifact) => artifact.modelId),
    [
      "minimaxai/minimax-m2.7",
      "moonshotai/kimi-k2.6",
      "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    ],
  );
});

test("live model loading aborts on an empty live catalog", () => {
  const result = loadQualifiedLiveModels({
    modelIds: [],
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "empty_live_catalog");
});
