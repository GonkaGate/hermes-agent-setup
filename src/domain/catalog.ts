import type { OnboardFailure } from "./runtime.js";

export interface LiveGonkaGateCatalog {
  modelIds: readonly string[];
  models?: readonly LiveGonkaGateModel[];
}

/**
 * One entry of the live GonkaGate `GET /v1/models` response.
 *
 * Only `modelId` is guaranteed. Every other field is optional metadata that a
 * gateway may omit or return as `null`; the helper must stay usable against a
 * gateway that only returns `id` / `object` / `created` / `owned_by`.
 */
export interface LiveGonkaGateModel {
  contextLength?: number;
  description?: string;
  displayName?: string;
  modelId: string;
}

export type CatalogClientResult =
  | {
      attempts: number;
      catalog: LiveGonkaGateCatalog;
      ok: true;
    }
  | {
      attempts: number;
      failure: OnboardFailure;
      ok: false;
    };
