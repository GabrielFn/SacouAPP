import { LogBox } from "react-native";

/**
 * Android recreates the activity (the court turning the phone, coming back from the share sheet) and
 * mounts the new root a moment before the old one stops, so the router's linking is seen twice for a
 * few milliseconds (R98, item 7: one copy of expo-router, no `linking` in the app). The warning is
 * only of development, and its toast covered the tabs.
 */
export const KNOWN_DEV_WARNINGS = [
  "Looks like you have configured linking in multiple places",
] as const;

export function quietKnownDevWarnings(isDevelopment: boolean): void {
  if (!isDevelopment) return;
  LogBox.ignoreLogs([...KNOWN_DEV_WARNINGS]);
}
