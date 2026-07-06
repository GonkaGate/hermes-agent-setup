import assert from "node:assert/strict";
import test from "node:test";
import { selectQualifiedModel } from "../src/ui/model-picker.js";
import type { QualifiedLiveModel } from "../src/gonkagate/qualified-models.js";
import { createNodeOnboardDependencies } from "../src/runtime/dependencies.js";

function createQualifiedLiveModel(
  modelId: string,
  options: {
    displayName?: string;
    recommended?: boolean;
  } = {},
): QualifiedLiveModel {
  return {
    displayName: options.displayName,
    modelId,
    recommended: options.recommended ?? false,
  };
}

test("model picker auto-selects a single live model", async () => {
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

test("model picker preserves live defaults while presenting models in stable sorted order", async () => {
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

test("model picker falls back to the first live model when no recommended entry exists", async () => {
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
  assert.equal(capturedDefaultValue, "zeta/model-z");
});

test("model picker auto-selects the first live model without a TTY", async () => {
  const result = await selectQualifiedModel(
    [
      createQualifiedLiveModel("zeta/model-z"),
      createQualifiedLiveModel("alpha/model-a"),
    ],
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

  assert.equal(result.result.selectionSource, "auto_default");
  assert.equal(result.result.model.modelId, "zeta/model-z");
});
