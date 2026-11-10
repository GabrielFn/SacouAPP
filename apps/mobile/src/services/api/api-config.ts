import { err, ok, type Result } from "@sacou/volley-rules";

/** The public build variable with the API's origin. The URL is not a secret (E4.2, D4). */
export const API_URL_VARIABLE = "EXPO_PUBLIC_API_URL";

export type ApiConfigError = { readonly code: "api-url-invalid"; readonly message: string };

// Scheme, host and an optional port: no user, no path, no query, no trailing slash. Parsed by hand,
// because the URL of React Native does not implement every getter.
const ORIGIN = /^(https?):\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?$/i;
const MAX_PORT = 65_535;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
// The private ranges of a home network (RFC 1918), where a developer runs the API on a laptop.
const PRIVATE_NETWORK = [
  /^10(?:\.[0-9]{1,3}){3}$/,
  /^192\.168(?:\.[0-9]{1,3}){2}$/,
  /^172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2}$/,
];

function isLocalNetwork(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || PRIVATE_NETWORK.some((range) => range.test(host));
}

function invalid(reason: string): Result<never, ApiConfigError> {
  // The message names the variable, never its value.
  return err({ code: "api-url-invalid", message: `${API_URL_VARIABLE} ${reason}.` });
}

/**
 * The API's origin, checked once: `https:` always; `http:` only in a development build and only to the
 * phone itself, the Android emulator or a private network (D4, D7).
 */
export function parseApiBaseUrl(
  raw: unknown,
  isDevelopment: boolean,
): Result<string, ApiConfigError> {
  if (typeof raw !== "string" || raw === "") return invalid("is not set");
  const match = ORIGIN.exec(raw);
  if (!match) return invalid("must be only a scheme, a host and a port");
  const [, scheme = "", host = "", port] = match;
  if (port !== undefined && Number(port) > MAX_PORT) return invalid("has an invalid port");
  if (scheme.toLowerCase() === "https") return ok(raw.toLowerCase());
  if (!isDevelopment) return invalid("must use https");
  if (!isLocalNetwork(host.toLowerCase())) return invalid("may use http only on a local network");
  return ok(raw.toLowerCase());
}

/** True when `url` is under the API's origin: the only place the ID token may go (D7). */
export function isApiUrl(baseUrl: string, url: string): boolean {
  return url.startsWith(`${baseUrl}/`);
}
