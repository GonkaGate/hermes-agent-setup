import {
  deriveOwnerOnlyMode,
  type AtomicTextWriter,
  writeAtomicTextFile,
} from "../io/atomic-write.js";
import { createWriteBackups } from "../io/backup.js";
import {
  createOnboardFailure,
  type OnboardFailure,
} from "../domain/runtime.js";
import type {
  ConfigMutationPlan,
  EnvMutationPlan,
  PhaseFourBackupArtifact,
  PhaseFourExecutionSuccess,
  PhaseFourWritePlan,
} from "../domain/writes.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";

export interface ExecuteWritePlanOptions {
  atomicWriter?: AtomicTextWriter;
  backupTimestamp?: string;
}

export async function executePlannedWrites(
  writePlan: PhaseFourWritePlan,
  dependencies: OnboardDependencies,
  options: ExecuteWritePlanOptions = {},
): Promise<
  | {
      ok: true;
      result: PhaseFourExecutionSuccess;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  const backupResult = await createWriteBackups(
    [writePlan.config, writePlan.env],
    dependencies,
    {
      timestamp: options.backupTimestamp,
    },
  );

  if (!backupResult.ok) {
    return backupResult;
  }

  const configBackup = backupResult.result.backups.find(
    (backup) => backup.target === "config",
  );
  const envBackup = backupResult.result.backups.find(
    (backup) => backup.target === "env",
  );

  if (writePlan.config.changed) {
    try {
      await writeConfigMutation(writePlan.config, dependencies, {
        atomicWriter: options.atomicWriter,
        backup: configBackup,
      });
    } catch (error) {
      return {
        failure: createConfigWriteFailure(writePlan.config.path, error),
        ok: false,
      };
    }
  }

  if (writePlan.env.changed) {
    try {
      await writeEnvMutation(writePlan.env, dependencies, {
        atomicWriter: options.atomicWriter,
        backup: envBackup,
      });
    } catch (error) {
      const rollbackResult = await rollbackConfigMutation(
        writePlan.config,
        configBackup,
        dependencies,
        {
          atomicWriter: options.atomicWriter,
        },
      );

      if (!rollbackResult.ok) {
        return rollbackResult;
      }

      return {
        failure: createEnvWriteFailure(writePlan.env.path, error, configBackup),
        ok: false,
      };
    }
  }

  return {
    ok: true,
    result: {
      backups: backupResult.result.backups,
      config: writePlan.config,
      env: writePlan.env,
      reviewText: writePlan.review.text,
    },
  };
}

async function writeConfigMutation(
  plan: ConfigMutationPlan,
  dependencies: Pick<OnboardDependencies, "fs">,
  options: {
    atomicWriter?: AtomicTextWriter;
    backup?: PhaseFourBackupArtifact;
  },
): Promise<void> {
  await writeAtomicTextFile(
    {
      contents: plan.nextContents,
      mode: options.backup?.mode,
      path: plan.path,
    },
    dependencies,
    {
      writer: options.atomicWriter,
    },
  );
}

async function writeEnvMutation(
  plan: EnvMutationPlan,
  dependencies: Pick<OnboardDependencies, "fs">,
  options: {
    atomicWriter?: AtomicTextWriter;
    backup?: PhaseFourBackupArtifact;
  },
): Promise<void> {
  const ownerOnlyMode = deriveOwnerOnlyMode(options.backup?.mode);

  await writeAtomicTextFile(
    {
      contents: plan.nextContents,
      mode: ownerOnlyMode,
      path: plan.path,
      postWriteMode: ownerOnlyMode,
    },
    dependencies,
    {
      writer: options.atomicWriter,
    },
  );
}

async function rollbackConfigMutation(
  configPlan: ConfigMutationPlan,
  configBackup: PhaseFourBackupArtifact | undefined,
  dependencies: Pick<OnboardDependencies, "fs">,
  options: {
    atomicWriter?: AtomicTextWriter;
  },
): Promise<
  | {
      ok: true;
    }
  | {
      failure: OnboardFailure;
      ok: false;
    }
> {
  if (!configPlan.changed || configBackup === undefined) {
    return {
      ok: true,
    };
  }

  try {
    if (configBackup.existedBefore && configBackup.backupPath !== undefined) {
      const backupContents = await dependencies.fs.readFile(
        configBackup.backupPath,
        "utf8",
      );

      await writeAtomicTextFile(
        {
          contents: backupContents,
          mode: configBackup.mode,
          path: configPlan.path,
        },
        dependencies,
        {
          writer: options.atomicWriter,
        },
      );
    } else {
      await dependencies.fs.removeFile(configPlan.path);
    }
  } catch (error) {
    return {
      failure: createRollbackFailure(configPlan.path, error, configBackup),
      ok: false,
    };
  }

  return {
    ok: true,
  };
}

function createConfigWriteFailure(
  path: string,
  cause: unknown,
): OnboardFailure {
  return createOnboardFailure("config_write_failed", {
    details: {
      path,
    },
    guidance:
      "Fix the config write failure and rerun the helper. The helper did not continue to the Hermes .env write step.",
    message:
      cause instanceof Error
        ? cause.message
        : "The helper could not write config.yaml safely.",
  });
}

function createEnvWriteFailure(
  path: string,
  cause: unknown,
  configBackup: PhaseFourBackupArtifact | undefined,
): OnboardFailure {
  const rollbackGuidance =
    configBackup?.existedBefore === true &&
    configBackup.backupPath !== undefined
      ? ` config.yaml was restored from ${configBackup.backupPath}.`
      : configBackup !== undefined
        ? " Any newly created config.yaml was removed during rollback."
        : "";

  return createOnboardFailure("env_write_failed", {
    details: {
      path,
    },
    guidance:
      `Fix the env write failure and rerun the helper.${rollbackGuidance}`.trim(),
    message:
      cause instanceof Error
        ? cause.message
        : "The helper could not write the Hermes .env file safely.",
  });
}

function createRollbackFailure(
  path: string,
  cause: unknown,
  configBackup: PhaseFourBackupArtifact | undefined,
): OnboardFailure {
  return createOnboardFailure("rollback_failed", {
    details: {
      ...(configBackup?.backupPath === undefined
        ? {}
        : { backupPath: configBackup.backupPath }),
      path,
    },
    guidance:
      configBackup?.backupPath === undefined
        ? "Inspect the partially written config.yaml manually and remove it if the helper created it during this run."
        : `Inspect ${path} and restore it from ${configBackup.backupPath} if needed.`,
    message:
      cause instanceof Error
        ? cause.message
        : "The helper could not roll config.yaml back after a later write failure.",
  });
}
