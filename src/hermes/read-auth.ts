import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { RawHermesFileResult } from "./read-shared.js";
import { readOptionalJsonFile } from "./read-shared.js";

export type RawHermesAuthFile = RawHermesFileResult<unknown>;

export async function readHermesAuthFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesAuthFile> {
  return await readOptionalJsonFile(path, dependencies);
}
