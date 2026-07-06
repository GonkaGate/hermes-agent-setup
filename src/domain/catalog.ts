import type { OnboardFailure } from "./runtime.js";

export interface LiveGonkaGateCatalog {
  modelIds: readonly string[];
  models?: readonly LiveGonkaGateModel[];
}

export interface LiveGonkaGateModel {
  displayName?: string;
  modelId: string;
  recommended: boolean;
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
