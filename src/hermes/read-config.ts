import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { RawHermesFileResult } from "./read-shared.js";
import { readOptionalYamlFile } from "./read-shared.js";

export type RawHermesConfigFile = RawHermesFileResult<unknown>;

export async function readHermesConfigFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesConfigFile> {
  return await readOptionalYamlFile(path, dependencies);
}
