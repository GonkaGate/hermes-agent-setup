import { join } from "node:path";
import type { ResolvedHermesContext } from "../domain/runtime.js";
import type { ConfigPathSegment } from "../domain/conflicts.js";
import type { OnboardDependencies } from "../runtime/dependencies.js";
import { CANONICAL_BASE_URL } from "../constants/contract.js";
import type { RawHermesAuthFile } from "./read-auth.js";
import { readHermesAuthFile } from "./read-auth.js";
import type { RawHermesConfigFile } from "./read-config.js";
import { readHermesConfigFile } from "./read-config.js";
import type { RawHermesCronFile } from "./read-cron.js";
import { readHermesCronFile } from "./read-cron.js";
import type { ParsedHermesEnvFile, RawHermesEnvFile } from "./read-env.js";
import { readHermesEnvFile } from "./read-env.js";
import {
  canonicalizeBaseUrl,
  getBooleanAtPath,
  getRecordAtPath,
  getStringAtPath,
  isRecord,
  normalizeBooleanValue,
  normalizeProviderName,
  normalizeStringValue,
} from "./provider-utils.js";

export interface NormalizedHermesModelConfig {
  api: string;
  apiKey: string;
  apiMode: string;
  baseUrl: string;
  defaultModel: string;
  provider: string;
}

export interface NormalizedHermesSmartCheapModelConfig {
  apiKey: string;
  apiKeyEnv: string;
  baseUrl: string;
  provider: string;
}

export interface NormalizedHermesSmartModelRoutingConfig {
  cheapModel: NormalizedHermesSmartCheapModelConfig;
  enabled: boolean;
}

export interface NormalizedHermesAuxiliaryTaskConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
  task: string;
}

export interface NormalizedHermesDelegationConfig {
  apiKey: string;
  baseUrl: string;
  provider: string;
}

export interface NormalizedHermesFallbackModelConfig {
  apiKey: string;
  apiKeyEnv: string;
  baseUrl: string;
  model: string;
  provider: string;
}

export interface NormalizedHermesVoiceToolConfig {
  provider: string;
}

export interface NormalizedHermesCronJob {
  baseUrl: string;
  id?: string;
  index: number;
  model: string;
  name?: string;
  provider: string;
  rawJob: Record<string, unknown>;
}

export interface NormalizedNamedCustomProviderEntry {
  apiKey: string;
  apiMode: string;
  canonicalUrlFieldKeys: readonly string[];
  keyEnv: string;
  matchingPoolKey: string;
  name: string;
  nonCanonicalUrlFieldKeys: readonly string[];
  normalizedName: string;
  path: string;
  pathSegments: readonly ConfigPathSegment[];
  rawEntry: Record<string, unknown>;
  resolvedBaseUrl: string;
  sourceShape: "custom_providers" | "providers";
  transport: string;
  urlFieldValues: Readonly<Record<string, string>>;
}

export interface NormalizedHermesReadFailure {
  code:
    | "auth_config_read_failed"
    | "config_parse_failed"
    | "cron_config_read_failed"
    | "env_read_failed";
  message: string;
  path: string;
}

export interface NormalizedHermesRead {
  config: {
    auxiliaryTasks: readonly NormalizedHermesAuxiliaryTaskConfig[];
    delegation: NormalizedHermesDelegationConfig;
    fallbackModel: NormalizedHermesFallbackModelConfig;
    model: NormalizedHermesModelConfig;
    normalizedRoot: Readonly<Record<string, unknown>>;
    rawRoot: Readonly<Record<string, unknown>>;
    smartModelRouting: NormalizedHermesSmartModelRoutingConfig;
    stt: NormalizedHermesVoiceToolConfig;
    tts: NormalizedHermesVoiceToolConfig;
  };
  context: ResolvedHermesContext;
  cronJobs: readonly NormalizedHermesCronJob[];
  env: {
    file: Readonly<Record<string, string>>;
    inheritedProcess: Readonly<Record<string, string>>;
    mergedRuntimeVisible: Readonly<Record<string, string>>;
  };
  namedCustomProviders: readonly NormalizedNamedCustomProviderEntry[];
  paths: {
    authPath: string;
    cronJobsPath: string;
  };
  raw: {
    auth: RawHermesAuthFile;
    config: RawHermesConfigFile;
    cron: RawHermesCronFile;
    env: RawHermesEnvFile;
  };
}

export type LoadNormalizedHermesReadResult =
  | {
      ok: true;
      read: NormalizedHermesRead;
    }
  | {
      failure: NormalizedHermesReadFailure;
      ok: false;
    };

export async function loadNormalizedHermesRead(
  context: ResolvedHermesContext,
  dependencies: OnboardDependencies,
): Promise<LoadNormalizedHermesReadResult> {
  const authPath = join(context.homeDir, "auth.json");
  const cronJobsPath = join(context.homeDir, "cron", "jobs.json");
  const [config, env, auth, cron] = await Promise.all([
    readHermesConfigFile(context.configPath, dependencies),
    readHermesEnvFile(context.envPath, dependencies),
    readHermesAuthFile(authPath, dependencies),
    readHermesCronFile(cronJobsPath, dependencies),
  ]);

  if (config.status === "read_error" || config.status === "parse_error") {
    return {
      failure: {
        code: "config_parse_failed",
        message:
          config.status === "read_error"
            ? config.errorMessage
            : config.errorMessage,
        path: config.path,
      },
      ok: false,
    };
  }

  if (env.status === "read_error") {
    return {
      failure: {
        code: "env_read_failed",
        message: env.errorMessage,
        path: env.path,
      },
      ok: false,
    };
  }

  if (auth.status === "read_error" || auth.status === "parse_error") {
    return {
      failure: {
        code: "auth_config_read_failed",
        message: auth.errorMessage,
        path: auth.path,
      },
      ok: false,
    };
  }

  if (cron.status === "read_error" || cron.status === "parse_error") {
    return {
      failure: {
        code: "cron_config_read_failed",
        message: cron.errorMessage,
        path: cron.path,
      },
      ok: false,
    };
  }

  const fileEnv = env.status === "ok" ? env.data.values : {};
  const inheritedProcessEnv = normalizeProcessEnvironment(
    dependencies.runtime.env,
  );
  const mergedRuntimeVisibleEnv = {
    ...inheritedProcessEnv,
    ...fileEnv,
  };
  const rawRoot = normalizeRawRoot(config);

  if (rawRoot === undefined) {
    return {
      failure: {
        code: "config_parse_failed",
        message: "Hermes config.yaml must parse to a mapping at the root.",
        path: context.configPath,
      },
      ok: false,
    };
  }

  const normalizedRoot = migrateLegacyModelFields(
    expandConfigValue(rawRoot, mergedRuntimeVisibleEnv),
  );

  return {
    ok: true,
    read: {
      config: {
        auxiliaryTasks: normalizeAuxiliaryTasks(normalizedRoot),
        delegation: normalizeDelegation(normalizedRoot),
        fallbackModel: normalizeFallbackModel(normalizedRoot),
        model: normalizeModel(normalizedRoot),
        normalizedRoot,
        rawRoot,
        smartModelRouting: normalizeSmartModelRouting(normalizedRoot),
        stt: normalizeVoiceTool(normalizedRoot, "stt"),
        tts: normalizeVoiceTool(normalizedRoot, "tts"),
      },
      context,
      cronJobs: normalizeCronJobs(cron),
      env: {
        file: fileEnv,
        inheritedProcess: inheritedProcessEnv,
        mergedRuntimeVisible: mergedRuntimeVisibleEnv,
      },
      namedCustomProviders: normalizeNamedCustomProviders(normalizedRoot),
      paths: {
        authPath,
        cronJobsPath,
      },
      raw: {
        auth,
        config,
        cron,
        env,
      },
    },
  };
}

function normalizeRawRoot(
  config: RawHermesConfigFile,
): Record<string, unknown> | undefined {
  if (config.status === "missing") {
    return {};
  }

  if (config.status !== "ok") {
    return undefined;
  }

  if (config.data === null) {
    return {};
  }

  return isRecord(config.data) ? config.data : undefined;
}

function normalizeProcessEnvironment(
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  const normalizedEntries = Object.entries(env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return Object.fromEntries(normalizedEntries);
}

function expandConfigValue(
  value: unknown,
  env: Readonly<Record<string, string>>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/giu, (match, variableName) =>
      Object.prototype.hasOwnProperty.call(env, variableName)
        ? (env[variableName] ?? "")
        : match,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => expandConfigValue(item, env));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      expandConfigValue(nestedValue, env),
    ]),
  );
}

function migrateLegacyModelFields(root: unknown): Record<string, unknown> {
  const safeRoot = isRecord(root) ? { ...root } : {};
  const modelValue = safeRoot.model;
  const migratedModel = isRecord(modelValue) ? { ...modelValue } : {};
  const legacyProvider = normalizeStringValue(safeRoot.provider);
  const legacyBaseUrl = normalizeStringValue(safeRoot.base_url);

  if (
    normalizeStringValue(migratedModel.provider).length === 0 &&
    legacyProvider.length > 0
  ) {
    migratedModel.provider = legacyProvider;
  }

  if (
    normalizeStringValue(migratedModel.base_url).length === 0 &&
    legacyBaseUrl.length > 0
  ) {
    migratedModel.base_url = legacyBaseUrl;
  }

  safeRoot.model = migratedModel;

  return safeRoot;
}

function normalizeModel(
  root: Readonly<Record<string, unknown>>,
): NormalizedHermesModelConfig {
  const modelRecord = getRecordAtPath(root, ["model"]);

  if (modelRecord === undefined && typeof root.model === "string") {
    return {
      api: "",
      apiKey: "",
      apiMode: "",
      baseUrl: "",
      defaultModel: normalizeStringValue(root.model),
      provider: "",
    };
  }

  return {
    api: normalizeStringValue(modelRecord?.api),
    apiKey: normalizeStringValue(modelRecord?.api_key),
    apiMode: normalizeStringValue(modelRecord?.api_mode),
    baseUrl: normalizeStringValue(modelRecord?.base_url),
    defaultModel: normalizeStringValue(modelRecord?.default),
    provider: normalizeStringValue(modelRecord?.provider),
  };
}

function normalizeSmartModelRouting(
  root: Readonly<Record<string, unknown>>,
): NormalizedHermesSmartModelRoutingConfig {
  const smartRouting = getRecordAtPath(root, ["smart_model_routing"]);
  const cheapModel = getRecordAtPath(root, [
    "smart_model_routing",
    "cheap_model",
  ]);

  return {
    cheapModel: {
      apiKey: normalizeStringValue(cheapModel?.api_key),
      apiKeyEnv: normalizeStringValue(cheapModel?.api_key_env),
      baseUrl: normalizeStringValue(cheapModel?.base_url),
      provider: normalizeStringValue(cheapModel?.provider),
    },
    enabled: normalizeBooleanValue(smartRouting?.enabled),
  };
}

function normalizeAuxiliaryTasks(
  root: Readonly<Record<string, unknown>>,
): readonly NormalizedHermesAuxiliaryTaskConfig[] {
  const auxiliaryRoot = getRecordAtPath(root, ["auxiliary"]);

  if (auxiliaryRoot === undefined) {
    return [];
  }

  return Object.entries(auxiliaryRoot)
    .filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    )
    .map(([task, taskConfig]) => ({
      apiKey: normalizeStringValue(taskConfig.api_key),
      baseUrl: normalizeStringValue(taskConfig.base_url),
      model: normalizeStringValue(taskConfig.model),
      provider: normalizeStringValue(taskConfig.provider),
      task,
    }));
}

function normalizeDelegation(
  root: Readonly<Record<string, unknown>>,
): NormalizedHermesDelegationConfig {
  const delegationRoot = getRecordAtPath(root, ["delegation"]);

  return {
    apiKey: normalizeStringValue(delegationRoot?.api_key),
    baseUrl: normalizeStringValue(delegationRoot?.base_url),
    provider: normalizeStringValue(delegationRoot?.provider),
  };
}

function normalizeFallbackModel(
  root: Readonly<Record<string, unknown>>,
): NormalizedHermesFallbackModelConfig {
  const fallbackRoot = getRecordAtPath(root, ["fallback_model"]);

  return {
    apiKey: normalizeStringValue(fallbackRoot?.api_key),
    apiKeyEnv: normalizeStringValue(fallbackRoot?.api_key_env),
    baseUrl: normalizeStringValue(fallbackRoot?.base_url),
    model: normalizeStringValue(fallbackRoot?.model),
    provider: normalizeStringValue(fallbackRoot?.provider),
  };
}

function normalizeVoiceTool(
  root: Readonly<Record<string, unknown>>,
  key: "stt" | "tts",
): NormalizedHermesVoiceToolConfig {
  return {
    provider: getStringAtPath(root, [key, "provider"]),
  };
}

function normalizeCronJobs(
  cron: RawHermesCronFile,
): readonly NormalizedHermesCronJob[] {
  if (cron.status !== "ok" || !Array.isArray(cron.data)) {
    return [];
  }

  return cron.data
    .filter((job): job is Record<string, unknown> => isRecord(job))
    .map((job, index) => ({
      baseUrl: normalizeStringValue(job.base_url),
      id: optionalString(job.id),
      index,
      model: normalizeStringValue(job.model),
      name: optionalString(job.name),
      provider: normalizeStringValue(job.provider),
      rawJob: job,
    }));
}

function normalizeNamedCustomProviders(
  root: Readonly<Record<string, unknown>>,
): readonly NormalizedNamedCustomProviderEntry[] {
  return [
    ...normalizeCustomProviders(root.custom_providers),
    ...normalizeProvidersDictionary(root.providers),
  ];
}

function normalizeCustomProviders(
  value: unknown,
): readonly NormalizedNamedCustomProviderEntry[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry, index) =>
        normalizeNamedProviderEntry(
          "custom_providers",
          normalizeStringValue(entry.name) || `custom-provider-${index + 1}`,
          entry,
          `custom_providers[${index}]`,
          ["custom_providers", index],
        ),
      );
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    )
    .map(([name, entry]) =>
      normalizeNamedProviderEntry(
        "custom_providers",
        normalizeStringValue(entry.name) || name,
        entry,
        `custom_providers.${name}`,
        ["custom_providers", name],
      ),
    );
}

function normalizeProvidersDictionary(
  value: unknown,
): readonly NormalizedNamedCustomProviderEntry[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    )
    .map(([name, entry]) =>
      normalizeNamedProviderEntry(
        "providers",
        name,
        entry,
        `providers.${name}`,
        ["providers", name],
      ),
    );
}

function normalizeNamedProviderEntry(
  sourceShape: "custom_providers" | "providers",
  name: string,
  rawEntry: Record<string, unknown>,
  path: string,
  pathSegments: readonly ConfigPathSegment[],
): NormalizedNamedCustomProviderEntry {
  const urlFieldValues = collectUrlFieldValues(rawEntry);
  const canonicalUrlFieldKeys = Object.entries(urlFieldValues)
    .filter(([, value]) => canonicalizeBaseUrl(value) === CANONICAL_BASE_URL)
    .map(([key]) => key);
  const nonCanonicalUrlFieldKeys =
    canonicalUrlFieldKeys.length === 0
      ? []
      : Object.entries(urlFieldValues)
          .filter(
            ([, value]) => canonicalizeBaseUrl(value) !== CANONICAL_BASE_URL,
          )
          .map(([key]) => key);
  const resolvedBaseUrl = resolveProviderBaseUrl(sourceShape, urlFieldValues);
  const normalizedName = normalizeProviderName(name);

  return {
    apiKey: normalizeStringValue(rawEntry.api_key),
    apiMode: normalizeStringValue(rawEntry.api_mode),
    canonicalUrlFieldKeys,
    keyEnv:
      normalizeStringValue(rawEntry.key_env) ||
      normalizeStringValue(rawEntry.api_key_env),
    matchingPoolKey: `custom:${normalizedName}`,
    name,
    nonCanonicalUrlFieldKeys,
    normalizedName,
    path,
    pathSegments,
    rawEntry,
    resolvedBaseUrl,
    sourceShape,
    transport: normalizeStringValue(rawEntry.transport),
    urlFieldValues,
  };
}

function collectUrlFieldValues(
  rawEntry: Record<string, unknown>,
): Record<string, string> {
  const values = Object.fromEntries(
    ["api", "url", "base_url"]
      .map((key) => [key, normalizeStringValue(rawEntry[key])])
      .filter((entry): entry is [string, string] => entry[1].length > 0),
  );

  return values;
}

function resolveProviderBaseUrl(
  sourceShape: "custom_providers" | "providers",
  urlFieldValues: Readonly<Record<string, string>>,
): string {
  const precedence =
    sourceShape === "providers"
      ? ["api", "url", "base_url"]
      : ["base_url", "url", "api"];

  for (const field of precedence) {
    const value = urlFieldValues[field];

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return "";
}

function optionalString(value: unknown): string | undefined {
  const normalizedValue = normalizeStringValue(value);

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}
