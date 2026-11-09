/**
 * The development screens (component catalog, sample court) are on in builds made with
 * `EXPO_PUBLIC_DEV_TOOLS=1`, a public build flag and not a secret. It is a flag, not `__DEV__`:
 * the test APK runs in production mode and still needs them (E4.9, plan section 2).
 */
const DEV_TOOLS_ON = "1";

export function isDevToolsFlagOn(flag: unknown): boolean {
  return flag === DEV_TOOLS_ON;
}

// Expo replaces this exact expression when it bundles, so it cannot be read through a variable.
const RAW_FLAG: unknown = process.env.EXPO_PUBLIC_DEV_TOOLS;

export const DEV_TOOLS_ENABLED = isDevToolsFlagOn(RAW_FLAG);
