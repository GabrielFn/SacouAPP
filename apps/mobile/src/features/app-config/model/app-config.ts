import type { AppConfig } from "../../../services/api/sacou-api";
import type { AppBuild } from "../app-build";

export type AppFeature = keyof AppConfig["features"];

/** What a feature is while the app has no answer of the API: on, like the catalog on the server (ADR 0084). */
const FEATURE_DEFAULT = true;

const HTTPS_PREFIX = "https://";

/** `true` only with a known minimum and a known build: no answer or no build never blocks (ADR 0084). */
export function isBelowMinimum(appBuild: AppBuild, config: AppConfig | undefined): boolean {
  if (config === undefined || appBuild.build === null) return false;
  return appBuild.build < config.minimumBuild[appBuild.platform];
}

/** The flag as the API said it; without an answer, the default of the catalog. */
export function isFeatureOn(config: AppConfig | undefined, feature: AppFeature): boolean {
  return config?.features[feature] ?? FEATURE_DEFAULT;
}

/** The store page of this platform, only when it is an HTTPS address: the screen has no button otherwise. */
export function updateUrlOf(appBuild: AppBuild, config: AppConfig | undefined): string | null {
  const url = config?.updateUrl[appBuild.platform] ?? null;
  return url !== null && url.startsWith(HTTPS_PREFIX) ? url : null;
}
