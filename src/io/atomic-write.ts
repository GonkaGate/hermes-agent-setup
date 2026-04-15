import writeFileAtomic from "write-file-atomic";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export interface AtomicTextWriteRequest {
  contents: string;
  mode?: number;
  path: string;
  postWriteMode?: number;
}

export interface AtomicTextWriteOptions {
  writer?: AtomicTextWriter;
}

export type AtomicTextWriter = (
  path: string,
  contents: string,
  options: {
    mode?: number;
  },
) => Promise<void>;

export async function writeAtomicTextFile(
  request: AtomicTextWriteRequest,
  dependencies: Pick<OnboardDependencies, "fs">,
  options: AtomicTextWriteOptions = {},
): Promise<void> {
  await (options.writer ?? defaultAtomicTextWriter)(
    request.path,
    request.contents,
    {
      mode: request.mode,
    },
  );

  if (request.postWriteMode !== undefined) {
    await dependencies.fs.chmod(request.path, request.postWriteMode);
  }
}

export function deriveOwnerOnlyMode(existingMode?: number): number {
  return existingMode === undefined ? 0o600 : existingMode & 0o700;
}

async function defaultAtomicTextWriter(
  path: string,
  contents: string,
  options: {
    mode?: number;
  },
): Promise<void> {
  await writeFileAtomic(path, contents, {
    encoding: "utf8",
    mode: options.mode,
  });
}
