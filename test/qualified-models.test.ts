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
  assert.equal(result.result.artifacts[0]?.recommended, true);
});

test("checked-in launch artifacts recommend Kimi K2.6 as the default", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies());

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.artifacts
      .filter((artifact) => artifact.recommended)
      .map((artifact) => artifact.modelId),
    ["moonshotai/Kimi-K2.6"],
  );
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

test("qualified-model loader rejects multiple recommended artifacts", async () => {
  const result = await loadQualifiedModelArtifacts(createDependencies(), {
    artifactsRoot: resolveQualificationFixture("duplicate-recommended"),
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "multiple_recommended_models");
});

test("qualified live models are intersected with the live catalog and sorted by exact model id", async () => {
  const result = await loadQualifiedLiveModels(
    {
      modelIds: ["qwen/qwen3-235b-a22b-instruct-2507-fp8", "alpha/model-a"],
    },
    createDependencies(),
    {
      artifactsRoot: resolveQualificationFixture("valid-multiple"),
    },
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    result.result.qualifiedLiveModels.map((model) => model.modelId),
    ["alpha/model-a", "qwen/qwen3-235b-a22b-instruct-2507-fp8"],
  );
});

test("qualified live model loading aborts on an empty live intersection", async () => {
  const result = await loadQualifiedLiveModels(
    {
      modelIds: ["missing/model"],
    },
    createDependencies(),
    {
      artifactsRoot: resolveQualificationFixture("valid-single"),
    },
  );

  assert.equal(result.ok, false);

  if (result.ok) {
    return;
  }

  assert.equal(result.failure.code, "qualified_models_unavailable");
  assert.equal(result.failure.details?.reason, "empty_live_intersection");
});
