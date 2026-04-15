import assert from "node:assert/strict";
import test from "node:test";
import { classifyMatchingProviders } from "../src/hermes/conflicts/matching-providers.js";
import { createHermesIntegrationHarness } from "./helpers/harness.js";
import { loadNormalizedReadForFixture } from "./helpers/phase-two.js";

test("matching provider classifier returns none when no named custom providers target GonkaGate", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "clean-home",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    assert.deepEqual(classifyMatchingProviders(readResult.read), {
      kind: "matching_provider",
      matchingEntries: [],
      status: "none",
    });
  } finally {
    await harness.cleanup();
  }
});

test("matching provider classifier marks a single providers: entry with conflicting selectors as scrubbable", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "providers-dict-match",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const conflict = classifyMatchingProviders(readResult.read);

    assert.equal(conflict.status, "scrubbable");

    if (conflict.status !== "scrubbable") {
      return;
    }

    const [match] = conflict.matchingEntries;

    assert.equal(match?.entry.sourceShape, "providers");
    assert.deepEqual([...(match?.scrubFields ?? [])].sort(), [
      "api_key",
      "api_mode",
      "transport",
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("matching provider classifier keeps a single canonical entry without competing selectors compatible", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "auth-pool-conflict",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const conflict = classifyMatchingProviders(readResult.read);

    assert.equal(conflict.status, "compatible");

    if (conflict.status !== "compatible") {
      return;
    }

    assert.equal(conflict.matchingEntries[0]?.entry.name, "gonkagate");
  } finally {
    await harness.cleanup();
  }
});

test("matching provider classifier blocks when multiple on-disk entries target the canonical GonkaGate URL", async () => {
  const harness = await createHermesIntegrationHarness({
    fixture: "named-provider-conflict",
  });

  try {
    await harness.installFakeHermesOnPath();

    const readResult = await loadNormalizedReadForFixture(harness);

    assert.equal(readResult.ok, true);

    if (!readResult.ok) {
      return;
    }

    const conflict = classifyMatchingProviders(readResult.read);

    assert.equal(conflict.status, "blocking");

    if (conflict.status !== "blocking") {
      return;
    }

    assert.equal(conflict.reason, "multiple_matching_entries");
    assert.equal(conflict.matchingEntries.length, 2);
  } finally {
    await harness.cleanup();
  }
});
