import type { OnboardDependencies } from "../runtime/dependencies.js";
import type { RawHermesFileResult } from "./read-shared.js";
import { readOptionalJsonFile } from "./read-shared.js";

export type RawHermesCronFile = RawHermesFileResult<unknown>;

export async function readHermesCronFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesCronFile> {
  return await readOptionalJsonFile(path, dependencies);
}
