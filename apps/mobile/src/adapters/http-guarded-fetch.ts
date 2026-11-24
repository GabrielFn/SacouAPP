import { isApiUrl } from "../services/api/api-config";
import type { HttpRequest, HttpTransport } from "../services/api/http-transport";

/** The transport failed (no network, timeout): `offline`. Anything else thrown is `unexpected`. */
export class NetworkFailure extends Error {}
/** A URL outside the API's origin: refused before anything is sent (D7). */
export class OtherOriginRefused extends Error {}

const BODYLESS_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "DELETE"]);

async function bodyOf(request: Request): Promise<string | null> {
  if (BODYLESS_METHODS.has(request.method)) return null;
  const text = await request.text();
  return text === "" ? null : text;
}

/** `ambientHeaders` go on every request, whatever the call (the app's build, ADR 0084). */
function withHeaders(headers: Headers, extra: Readonly<Record<string, string>>): Headers {
  const merged = new Headers(headers);
  Object.entries(extra).forEach(([name, value]) => {
    merged.set(name, value);
  });
  return merged;
}

export function createGuardedFetch(
  baseUrl: string,
  transport: HttpTransport,
  timeoutMs: number,
  ambientHeaders: Readonly<Record<string, string>> = {},
) {
  return async (request: Request): Promise<Response> => {
    if (!isApiUrl(baseUrl, request.url)) throw new OtherOriginRefused();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const sent: HttpRequest = {
        url: request.url,
        method: request.method,
        headers: withHeaders(request.headers, ambientHeaders),
        body: await bodyOf(request),
        signal: controller.signal,
      };
      return await transport(sent);
    } catch {
      // The reason may carry the URL: only the kind goes on.
      throw new NetworkFailure();
    } finally {
      clearTimeout(timer);
    }
  };
}

export function refuseEverything(): Promise<Response> {
  return Promise.reject(new OtherOriginRefused());
}
