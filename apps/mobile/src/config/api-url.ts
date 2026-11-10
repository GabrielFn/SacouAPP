import { parseApiBaseUrl } from "../services/api/api-config";

/**
 * The API's origin of this build, or `null` for a build without an API (the test APK until the first
 * deploy): the client then sends nothing. A value that is set but wrong stops the app at start, with a
 * message that names the variable and not the value (E4.2, D4).
 */
export function readApiBaseUrl(raw: unknown, isDevelopment: boolean): string | null {
  if (raw === undefined || raw === "") return null;
  const parsed = parseApiBaseUrl(raw, isDevelopment);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

// Expo replaces this exact expression when it bundles, so it cannot be read through a variable.
const RAW_API_URL: unknown = process.env.EXPO_PUBLIC_API_URL;

export function buildApiBaseUrl(isDevelopment: boolean): string | null {
  return readApiBaseUrl(RAW_API_URL, isDevelopment);
}
