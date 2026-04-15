import { CANONICAL_BASE_URL } from "../../constants/contract.js";
import type { SharedOpenAiKeyConflict } from "../../domain/conflicts.js";
import type { NormalizedHermesRead } from "../normalized-read.js";
import { canonicalizeBaseUrl } from "../provider-utils.js";

export function classifySharedOpenAiKeyConflicts(
  read: NormalizedHermesRead,
): readonly SharedOpenAiKeyConflict[] {
  const conflicts: SharedOpenAiKeyConflict[] = [];
  const hasOpenRouterKey = hasUsableVisibleSecret(read, "OPENROUTER_API_KEY");

  if (matchesMainCustomEndpoint(read)) {
    conflicts.push({
      kind: "shared_openai_key",
      label: "Main custom endpoint",
      location: "model",
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "main_custom_endpoint",
    });
  } else if (
    matchesOpenRouterProvider(read.config.model.provider) &&
    !hasOpenRouterKey
  ) {
    conflicts.push({
      kind: "shared_openai_key",
      label: "Main OpenRouter fallback",
      location: "model",
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "main_openrouter_fallback",
    });
  }

  if (read.config.smartModelRouting.enabled) {
    const cheapModel = read.config.smartModelRouting.cheapModel;

    if (cheapModel.baseUrl.length > 0) {
      const dedicatedKeyName = cheapModel.apiKeyEnv;
      const hasDedicatedKey =
        dedicatedKeyName.length > 0 &&
        hasUsableVisibleSecret(read, dedicatedKeyName);

      if (!hasDedicatedKey) {
        conflicts.push({
          kind: "shared_openai_key",
          label: "Smart cheap route (direct endpoint)",
          location: "smart_model_routing.cheap_model",
          reason: "uses_shared_openai_api_key",
          status: "confirmation_required",
          surfaceId: "smart_cheap_route_direct_endpoint",
        });
      }
    } else if (cheapModel.provider === "custom") {
      conflicts.push({
        kind: "shared_openai_key",
        label: "Smart cheap route (ambiguous custom provider)",
        location: "smart_model_routing.cheap_model",
        reason: "ambiguous_custom_provider_without_base_url",
        status: "blocking",
        surfaceId: "smart_cheap_route_ambiguous_custom",
      });
    } else if (cheapModel.provider === "openrouter" && !hasOpenRouterKey) {
      conflicts.push({
        kind: "shared_openai_key",
        label: "Smart cheap route (OpenRouter)",
        location: "smart_model_routing.cheap_model",
        reason: "uses_shared_openai_api_key",
        status: "confirmation_required",
        surfaceId: "smart_cheap_route_openrouter",
      });
    }
  }

  for (const task of read.config.auxiliaryTasks) {
    if (task.baseUrl.length > 0) {
      if (task.apiKey.length === 0) {
        conflicts.push({
          kind: "shared_openai_key",
          label: `Auxiliary ${task.task} direct endpoint`,
          location: `auxiliary.${task.task}`,
          reason: "uses_shared_openai_api_key",
          status: "confirmation_required",
          surfaceId: "auxiliary_direct_endpoint",
        });
      }

      continue;
    }

    if (task.provider === "openrouter" && !hasOpenRouterKey) {
      conflicts.push({
        kind: "shared_openai_key",
        label: `Auxiliary ${task.task} OpenRouter override`,
        location: `auxiliary.${task.task}`,
        reason: "uses_shared_openai_api_key",
        status: "confirmation_required",
        surfaceId: "auxiliary_openrouter_override",
      });
    }
  }

  if (
    read.config.delegation.baseUrl.length > 0 &&
    read.config.delegation.apiKey.length === 0
  ) {
    conflicts.push({
      kind: "shared_openai_key",
      label: "Delegation direct endpoint",
      location: "delegation",
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "delegation_direct_endpoint",
    });
  }

  if (read.config.fallbackModel.baseUrl.length > 0) {
    conflicts.push({
      kind: "shared_openai_key",
      label: "Fallback direct endpoint",
      location: "fallback_model",
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "fallback_direct_endpoint",
    });
  } else if (
    read.config.fallbackModel.provider === "openrouter" &&
    !hasOpenRouterKey
  ) {
    conflicts.push({
      kind: "shared_openai_key",
      label: "Fallback OpenRouter route",
      location: "fallback_model",
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "fallback_openrouter_route",
    });
  }

  for (const job of read.cronJobs) {
    if (job.baseUrl.length > 0) {
      conflicts.push({
        kind: "shared_openai_key",
        jobId: job.id,
        jobName: job.name,
        label: formatCronLabel("Cron direct endpoint", job),
        location: `cron.jobs[${job.index}]`,
        reason: "uses_shared_openai_api_key",
        status: "confirmation_required",
        surfaceId: "cron_direct_endpoint",
      });

      continue;
    }

    if (job.provider === "openrouter" && !hasOpenRouterKey) {
      conflicts.push({
        kind: "shared_openai_key",
        jobId: job.id,
        jobName: job.name,
        label: formatCronLabel("Cron OpenRouter override", job),
        location: `cron.jobs[${job.index}]`,
        reason: "uses_shared_openai_api_key",
        status: "confirmation_required",
        surfaceId: "cron_openrouter_override",
      });
    }
  }

  const voiceToolUsers = [
    read.config.tts.provider === "openai" ? "tts" : "",
    read.config.stt.provider === "openai" ? "stt" : "",
  ].filter((value) => value.length > 0);

  if (
    voiceToolUsers.length > 0 &&
    !hasUsableVisibleSecret(read, "VOICE_TOOLS_OPENAI_KEY")
  ) {
    conflicts.push({
      kind: "shared_openai_key",
      label: `OpenAI voice tooling (${voiceToolUsers.join(", ")})`,
      location: voiceToolUsers.join(","),
      reason: "uses_shared_openai_api_key",
      status: "confirmation_required",
      surfaceId: "openai_voice_tooling",
    });
  }

  return conflicts;
}

function hasUsableVisibleSecret(
  read: NormalizedHermesRead,
  envKey: string,
): boolean {
  const value = read.env.mergedRuntimeVisible[envKey];

  return typeof value === "string" && value.trim().length > 0;
}

function matchesMainCustomEndpoint(read: NormalizedHermesRead): boolean {
  const { baseUrl, provider } = read.config.model;

  if (baseUrl.length === 0) {
    return false;
  }

  if (
    canonicalizeBaseUrl(baseUrl) === CANONICAL_BASE_URL &&
    (provider === "custom" || provider === "" || provider === "auto")
  ) {
    return false;
  }

  return provider === "custom" || provider === "" || provider === "auto";
}

function matchesOpenRouterProvider(provider: string): boolean {
  return provider === "auto" || provider === "openrouter";
}

function formatCronLabel(
  prefix: string,
  job: NormalizedHermesRead["cronJobs"][number],
): string {
  const identity = job.name ?? job.id;

  return identity === undefined ? prefix : `${prefix} (${identity})`;
}
