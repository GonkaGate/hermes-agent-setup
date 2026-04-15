import type { OnboardFailure } from "./runtime.js";

export interface LiveGonkaGateCatalog {
  modelIds: readonly string[];
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
