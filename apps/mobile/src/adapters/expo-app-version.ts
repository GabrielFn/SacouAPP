import Constants from "expo-constants";

const UNKNOWN_VERSION = "0.0.0";

/** The version of the app, part of the persisted cache's buster (E4.2, D6). */
export function expoAppVersion(): string {
  return Constants.expoConfig?.version ?? UNKNOWN_VERSION;
}
