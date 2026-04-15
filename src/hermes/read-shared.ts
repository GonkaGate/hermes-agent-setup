import YAML from "yaml";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export type RawHermesFileResult<TData> =
  | {
      exists: false;
      path: string;
      status: "missing";
    }
  | {
      exists: true;
      path: string;
      rawText: string;
      status: "ok";
      data: TData;
    }
  | {
      exists: true;
      path: string;
      status: "read_error";
      errorCode: string;
      errorMessage: string;
    }
  | {
      exists: true;
      path: string;
      rawText: string;
      status: "parse_error";
      errorMessage: string;
    };

export async function readOptionalTextFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<
  | {
      exists: false;
      path: string;
      status: "missing";
    }
  | {
      exists: true;
      path: string;
      rawText: string;
      status: "ok";
    }
  | {
      exists: true;
      path: string;
      status: "read_error";
      errorCode: string;
      errorMessage: string;
    }
> {
  try {
    const stats = await dependencies.fs.stat(path);

    if (!stats.isFile()) {
      return {
        errorCode: "not_a_file",
        errorMessage: `Expected a file at ${path}.`,
        exists: true,
        path,
        status: "read_error",
      };
    }
  } catch (error) {
    if (isMissingPathError(error)) {
      return {
        exists: false,
        path,
        status: "missing",
      };
    }

    return {
      errorCode: extractErrorCode(error),
      errorMessage: formatErrorMessage(error),
      exists: true,
      path,
      status: "read_error",
    };
  }

  try {
    return {
      exists: true,
      path,
      rawText: await dependencies.fs.readFile(path, "utf8"),
      status: "ok",
    };
  } catch (error) {
    return {
      errorCode: extractErrorCode(error),
      errorMessage: formatErrorMessage(error),
      exists: true,
      path,
      status: "read_error",
    };
  }
}

export async function readOptionalJsonFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesFileResult<unknown>> {
  const textResult = await readOptionalTextFile(path, dependencies);

  if (textResult.status !== "ok") {
    return textResult;
  }

  try {
    return {
      data: JSON.parse(textResult.rawText) as unknown,
      exists: true,
      path,
      rawText: textResult.rawText,
      status: "ok",
    };
  } catch (error) {
    return {
      errorMessage: formatErrorMessage(error),
      exists: true,
      path,
      rawText: textResult.rawText,
      status: "parse_error",
    };
  }
}

export async function readOptionalYamlFile(
  path: string,
  dependencies: OnboardDependencies,
): Promise<RawHermesFileResult<unknown>> {
  const textResult = await readOptionalTextFile(path, dependencies);

  if (textResult.status !== "ok") {
    return textResult;
  }

  try {
    return {
      data: YAML.parse(textResult.rawText) as unknown,
      exists: true,
      path,
      rawText: textResult.rawText,
      status: "ok",
    };
  } catch (error) {
    return {
      errorMessage: formatErrorMessage(error),
      exists: true,
      path,
      rawText: textResult.rawText,
      status: "parse_error",
    };
  }
}

export function extractErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  ) {
    return (error as NodeJS.ErrnoException).code ?? "unknown";
  }

  return "unknown";
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isMissingPathError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
