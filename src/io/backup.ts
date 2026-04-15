import { basename, dirname, join } from "node:path";
import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  BaseTextMutationPlan,
  PhaseFourBackupArtifact,
} from "../domain/writes.js";
import { isMissingPathError } from "../hermes/read-shared.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export interface CreateWriteBackupsOptions {
  timestamp?: string;
}

export interface WriteBackupResult {
  backups: readonly PhaseFourBackupArtifact[];
  timestamp: string;
}

export async function createWriteBackups(
  mutationPlans: readonly BaseTextMutationPlan[],
  dependencies: Pick<OnboardDependencies, "fs">,
  options: CreateWriteBackupsOptions = {},
): Promise<
  | {
      ok: true;
      result: WriteBackupResult;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  const changedPlans = mutationPlans.filter((plan) => plan.changed);
  const timestamp = options.timestamp ?? createUtcTimestamp();
  const plannedBackups: PhaseFourBackupArtifact[] = [];

  for (const plan of changedPlans) {
    if (!plan.existedBefore) {
      plannedBackups.push({
        existedBefore: false,
        path: plan.path,
        target: plan.target,
      });
      continue;
    }

    let stats;

    try {
      stats = await dependencies.fs.stat(plan.path);
    } catch (error) {
      return {
        failure: createBackupFailure(
          plan.path,
          "stat_failed",
          error,
          plan.target,
        ),
        ok: false,
      };
    }

    const backupPath = buildSiblingBackupPath(plan.path, timestamp);

    if (await pathExists(backupPath, dependencies)) {
      return {
        failure: createOnboardFailure("backup_failed", {
          details: {
            backupPath,
            path: plan.path,
            target: plan.target,
          },
          guidance:
            "Remove or rename the colliding backup file, then rerun the helper before any Hermes files are changed.",
          message: `The helper found an existing backup path collision at ${backupPath}.`,
        }),
        ok: false,
      };
    }

    plannedBackups.push({
      backupPath,
      existedBefore: true,
      mode: stats.mode & 0o777,
      path: plan.path,
      target: plan.target,
    });
  }

  for (const backup of plannedBackups) {
    if (!backup.existedBefore || backup.backupPath === undefined) {
      continue;
    }

    try {
      await dependencies.fs.copyFile(backup.path, backup.backupPath);
    } catch (error) {
      return {
        failure: createBackupFailure(
          backup.path,
          "copy_failed",
          error,
          backup.target,
          backup.backupPath,
        ),
        ok: false,
      };
    }
  }

  return {
    ok: true,
    result: {
      backups: Object.freeze(plannedBackups),
      timestamp,
    },
  };
}

export function buildSiblingBackupPath(
  path: string,
  timestamp: string,
): string {
  return join(
    dirname(path),
    `${basename(path)}.bak.${timestamp}.hermes-agent-setup`,
  );
}

export function createUtcTimestamp(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

async function pathExists(
  path: string,
  dependencies: Pick<OnboardDependencies, "fs">,
): Promise<boolean> {
  try {
    await dependencies.fs.stat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
  }
}

function createBackupFailure(
  path: string,
  reason: string,
  cause: unknown,
  target: BaseTextMutationPlan["target"],
  backupPath?: string,
): OnboardFailure {
  return createOnboardFailure("backup_failed", {
    details: {
      ...(backupPath === undefined ? {} : { backupPath }),
      path,
      reason,
      target,
    },
    guidance:
      "Fix the backup issue and rerun the helper before any Hermes files are changed.",
    message:
      cause instanceof Error
        ? cause.message
        : "The helper could not create a safe backup before writing Hermes files.",
  });
}
