import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { RawHermesFileResult } from "./read-shared.js";
import { readOptionalTextFile } from "./read-shared.js";

export interface ParsedHermesEnvFile {
  orderedKeys: readonly string[];
  values: Readonly<Record<string, string>>;
}

export type RawHermesEnvFile = RawHermesFileResult<ParsedHermesEnvFile>;

export async function readHermesEnvFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesEnvFile> {
  const textResult = await readOptionalTextFile(path, dependencies);

  if (textResult.status !== "ok") {
    return textResult;
  }

  return {
    data: parseEnvFile(textResult.rawText),
    exists: true,
    path,
    rawText: textResult.rawText,
    status: "ok",
  };
}

export function parseEnvFile(rawText: string): ParsedHermesEnvFile {
  const values: Record<string, string> = {};
  const orderedKeys: string[] = [];

  for (const line of rawText.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const lineWithoutExport = trimmedLine.startsWith("export ")
      ? trimmedLine.slice("export ".length)
      : trimmedLine;
    const delimiterIndex = lineWithoutExport.indexOf("=");

    if (delimiterIndex <= 0) {
      continue;
    }

    const key = lineWithoutExport.slice(0, delimiterIndex).trim();

    if (key.length === 0) {
      continue;
    }

    const rawValue = lineWithoutExport.slice(delimiterIndex + 1).trim();
    const value = unwrapQuotedValue(rawValue);

    if (!(key in values)) {
      orderedKeys.push(key);
    }

    values[key] = value;
  }

  return {
    orderedKeys,
    values,
  };
}

function unwrapQuotedValue(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const firstCharacter = value[0];
  const lastCharacter = value[value.length - 1];

  if (
    (firstCharacter === `"` && lastCharacter === `"`) ||
    (firstCharacter === `'` && lastCharacter === `'`)
  ) {
    return value.slice(1, -1);
  }

  return value;
}
