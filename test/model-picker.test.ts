import assert from "node:assert/strict";
import test from "node:test";
import { selectQualifiedModel } from "../src/ui/model-picker.js";
import type { QualifiedLiveModel } from "../src/gonkagate/qualified-models.js";
import { createNodeOnboardDependencies } from "../src/runtime/dependencies.js";

function createQualifiedLiveModel(
  modelId: string,
  options: {
    recommended?: boolean;
  } = {},
): QualifiedLiveModel {
  return {
    artifactPath: `/tmp/${modelId}.md`,
    hermesCommit: "abcdef1234567890",
    hermesReleaseTag: "v2026.4.13",
    modelId,
    osCoverage: ["linux", "macos", "wsl2"],
    qualifiedOn: "2026-04-15",
    recommended: options.recommended ?? false,
    slug: modelId.replace(/[^a-z0-9]+/giu, "-").toLowerCase(),
  };
}

test("model picker auto-selects a single qualified live model", async () => {
  const result = await selectQualifiedModel(
    [createQualifiedLiveModel("qwen/qwen3-235b-a22b-instruct-2507-fp8")],
    createNodeOnboardDependencies({
      runtime: {
        stdinIsTTY: false,
        stdoutIsTTY: false,
      },
    }),
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.result.selectionSource, "auto_single_option");
  assert.equal(
    result.result.model.modelId,
    "qwen/qwen3-235b-a22b-instruct-2507-fp8",
  );
});

test("model picker preserves recommended defaults while presenting models in stable sorted order", async () => {
  const seenOptions: {
    choices: readonly string[];
    defaultValue?: string;
  }[] = [];
  const result = await selectQualifiedModel(
    [
      createQualifiedLiveModel("qwen/qwen3-235b-a22b-instruct-2507-fp8", {
        recommended: true,
      }),
      createQualifiedLiveModel("alpha/model-a"),
    ],
    createNodeOnboardDependencies({
      prompts: {
        async selectOption<TValue extends string>(options: {
          choices: readonly { value: TValue }[];
          defaultValue?: TValue;
        }) {
          seenOptions.push({
            choices: options.choices.map((choice) => choice.value),
            defaultValue: options.defaultValue,
          });

          return "alpha/model-a" as TValue;
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.deepEqual(seenOptions, [
    {
      choices: ["alpha/model-a", "qwen/qwen3-235b-a22b-instruct-2507-fp8"],
      defaultValue: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    },
  ]);
  assert.equal(result.result.model.modelId, "alpha/model-a");
});

test("model picker falls back to the first sorted model when no recommended entry exists", async () => {
  let capturedDefaultValue: string | undefined;
  const result = await selectQualifiedModel(
    [
      createQualifiedLiveModel("zeta/model-z"),
      createQualifiedLiveModel("alpha/model-a"),
    ],
    createNodeOnboardDependencies({
      prompts: {
        async selectOption<TValue extends string>(options: {
          choices: readonly { value: TValue }[];
          defaultValue?: TValue;
        }) {
          capturedDefaultValue = options.defaultValue;
          return (
            options.defaultValue ??
            options.choices[0]?.value ??
            ("alpha/model-a" as TValue)
          );
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(capturedDefaultValue, "alpha/model-a");
});
