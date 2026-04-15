import { CANONICAL_BASE_URL } from "../../constants/contract.js";
import type { OpenAiBaseUrlConflict } from "../../domain/conflicts.js";
import type { NormalizedHermesRead } from "../normalized-read.js";
import { canonicalizeBaseUrl } from "../provider-utils.js";

export function classifyOpenAiBaseUrlConflicts(
  read: NormalizedHermesRead,
): readonly OpenAiBaseUrlConflict[] {
  const conflicts: OpenAiBaseUrlConflict[] = [];
  const fileValue = normalizeEnvValue(read.env.file.OPENAI_BASE_URL);
  const inheritedValue = normalizeEnvValue(
    read.env.inheritedProcess.OPENAI_BASE_URL,
  );

  if (fileValue.length > 0) {
    conflicts.push(
      canonicalizeBaseUrl(fileValue) === CANONICAL_BASE_URL
        ? {
            canonicalValue: CANONICAL_BASE_URL,
            kind: "openai_base_url",
            resolution: "clear_file_value_without_confirmation",
            source: "file",
            status: "planned_cleanup",
            value: fileValue,
          }
        : {
            canonicalValue: CANONICAL_BASE_URL,
            kind: "openai_base_url",
            resolution: "clear_file_value",
            source: "file",
            status: "confirmation_required",
            value: fileValue,
          },
    );
  }

  if (inheritedValue.length > 0) {
    conflicts.push(
      canonicalizeBaseUrl(inheritedValue) === CANONICAL_BASE_URL
        ? {
            canonicalValue: CANONICAL_BASE_URL,
            kind: "openai_base_url",
            resolution: "warn_same_shell_runtime",
            source: "inherited_process",
            status: "advisory",
            value: inheritedValue,
          }
        : {
            canonicalValue: CANONICAL_BASE_URL,
            kind: "openai_base_url",
            resolution: "unset_shell_and_rerun",
            source: "inherited_process",
            status: "blocking",
            value: inheritedValue,
          },
    );
  }

  return conflicts;
}

function normalizeEnvValue(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
