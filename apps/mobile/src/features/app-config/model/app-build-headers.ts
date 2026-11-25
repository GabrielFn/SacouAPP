import type { AppBuild } from "../app-build";

export const APP_BUILD_HEADER = "X-Sacou-App-Build";
export const APP_PLATFORM_HEADER = "X-Sacou-App-Platform";

/** The two headers every request carries so the API can answer 426 to an old build; none without a build. */
export function appBuildHeaders(appBuild: AppBuild): Readonly<Record<string, string>> {
  if (appBuild.build === null) return {};
  return {
    [APP_BUILD_HEADER]: String(appBuild.build),
    [APP_PLATFORM_HEADER]: appBuild.platform,
  };
}

const BUILD_NUMBER = /^[0-9]{1,9}$/;

/** The native build text of the store ("42") as a number; anything else (a dotted name, empty, null) is no build. */
export function parseNativeBuild(text: string | null): number | null {
  return text !== null && BUILD_NUMBER.test(text) ? Number(text) : null;
}
