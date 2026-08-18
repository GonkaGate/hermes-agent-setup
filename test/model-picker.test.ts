import assert from "node:assert/strict";
import test from "node:test";
import { selectQualifiedModel } from "../src/ui/model-picker.js";
import type { QualifiedLiveModel } from "../src/gonkagate/qualified-models.js";
import { createNodeOnboardDependencies } from "../src/runtime/dependencies.js";

function createQualifiedLiveModel(
  modelId: string,
  options: {
    contextLength?: number;
    description?: string;
    displayName?: string;
  } = {},
): QualifiedLiveModel {
  return {
    contextLength: options.contextLength,
    description: options.description,
    displayName: options.displayName,
    modelId,
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

test("model picker defaults to the first live model and keeps live catalog order", async () => {
  const seenOptions: {
    choices: readonly string[];
    defaultValue?: string;
  }[] = [];
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
      choices: ["zeta/model-z", "alpha/model-a"],
      defaultValue: "zeta/model-z",
    },
  ]);
  assert.equal(result.result.model.modelId, "alpha/model-a");
});

test("model picker renders live catalog metadata when the gateway provides it", async () => {
  const seenChoices: {
    description?: string;
    label: string;
    value: string;
  }[] = [];
  const result = await selectQualifiedModel(
    [
      createQualifiedLiveModel("deepseek-ai/deepseek-v4-flash-0731", {
        contextLength: 400000,
        description: "Fast agentic coding model.",
        displayName: "DeepSeek V4 Flash 0731",
      }),
      createQualifiedLiveModel("moonshotai/kimi-k2.6", {
        contextLength: 240000,
        displayName: "Kimi K2.6",
      }),
    ],
    createNodeOnboardDependencies({
      prompts: {
        async selectOption<TValue extends string>(options: {
          choices: readonly {
            description?: string;
            label: string;
            value: TValue;
          }[];
          defaultValue?: TValue;
        }) {
          seenChoices.push(...options.choices);
          return options.choices[0]?.value ?? ("" as TValue);
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(seenChoices, [
    {
      description: "Fast agentic coding model. - 400,000 token context",
      label:
        "DeepSeek V4 Flash 0731 (deepseek-ai/deepseek-v4-flash-0731) (Default)",
      value: "deepseek-ai/deepseek-v4-flash-0731",
    },
    {
      description: "Live GonkaGate model - 240,000 token context",
      label: "Kimi K2.6 (moonshotai/kimi-k2.6)",
      value: "moonshotai/kimi-k2.6",
    },
  ]);
});

test("model picker stays usable when the gateway returns ids without metadata", async () => {
  const seenChoices: {
    description?: string;
    label: string;
    value: string;
  }[] = [];
  const result = await selectQualifiedModel(
    [
      createQualifiedLiveModel("deepseek-ai/deepseek-v4-flash-0731"),
      createQualifiedLiveModel("moonshotai/kimi-k2.6"),
    ],
    createNodeOnboardDependencies({
      prompts: {
        async selectOption<TValue extends string>(options: {
          choices: readonly {
            description?: string;
            label: string;
            value: TValue;
          }[];
          defaultValue?: TValue;
        }) {
          seenChoices.push(...options.choices);
          return options.choices[0]?.value ?? ("" as TValue);
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(seenChoices, [
    {
      description: "Live catalog default",
      label: "deepseek-ai/deepseek-v4-flash-0731 (Default)",
      value: "deepseek-ai/deepseek-v4-flash-0731",
    },
    {
      description: "Live GonkaGate model",
      label: "moonshotai/kimi-k2.6",
      value: "moonshotai/kimi-k2.6",
    },
  ]);

  for (const choice of seenChoices) {
    assert.doesNotMatch(choice.description ?? "", /0 token|null|undefined/u);
  }
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
