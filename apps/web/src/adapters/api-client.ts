import { failureOf } from "../round-page/api-failures";
import type { ApiOutcome } from "../round-page/ports";

/** The parts of `fetch` the adapters use, so a test hands a fake. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface FetchApiOptions {
  readonly fetch: FetchLike;
  readonly idToken: () => Promise<string | null>;
}

/** No request left: no connection, or no session to sign it with. */
export type NoResponse = "offline" | "signedOut";

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

const unexpected = { ok: false, failure: { kind: "unexpected" } } as const;
const offline = { ok: false, failure: { kind: "offline" } } as const;

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function refusal(response: Response): Promise<ApiOutcome<never>> {
  const body = await bodyOf(response);
  const code = isRecord(body) && typeof body.code === "string" ? body.code : null;
  const joined = isRecord(body) && typeof body.joined === "boolean" ? body.joined : null;
  const retryAfter = response.headers.get("Retry-After");
  return { ok: false, failure: failureOf({ status: response.status, code, retryAfter, joined }) };
}

export function lost(reason: NoResponse): ApiOutcome<never> {
  return reason === "offline" ? offline : unexpected;
}

export interface ApiClient {
  /** One request to the API: JSON body, the ID token in `Authorization`, no cookie, no cache, no redirect. */
  call(method: string, path: string, body?: unknown): Promise<Response | NoResponse>;
  /** The answer's body through `parse`; a body `parse` refuses is `unexpected`. */
  read<T>(
    response: Response | NoResponse,
    parse: (body: unknown) => T | null,
  ): Promise<ApiOutcome<T>>;
  /** A request whose body the page does not read: only whether it passed. */
  send(method: string, path: string, body?: unknown): Promise<ApiOutcome<null>>;
}

/** The Sacou API on the page's own origin: JSON bodies, the ID token in `Authorization`, never a cookie (ADR 0070, D4). */
export function createApiClient(options: FetchApiOptions): ApiClient {
  async function call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response | NoResponse> {
    const token = await options.idToken();
    if (token === null) return "signedOut";
    const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const init: RequestInit = { method, credentials: "omit", cache: "no-store", redirect: "error" };
    const request: RequestInit =
      body === undefined
        ? { ...init, headers: auth }
        : {
            ...init,
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          };
    try {
      return await options.fetch(path, request);
    } catch {
      return "offline";
    }
  }

  async function read<T>(
    response: Response | NoResponse,
    parse: (body: unknown) => T | null,
  ): Promise<ApiOutcome<T>> {
    if (typeof response === "string") return lost(response);
    if (!response.ok) return refusal(response);
    const value = parse(await bodyOf(response));
    return value === null ? unexpected : { ok: true, value };
  }

  async function send(method: string, path: string, body?: unknown): Promise<ApiOutcome<null>> {
    const response = await call(method, path, body);
    if (typeof response === "string") return lost(response);
    return response.ok ? { ok: true, value: null } : refusal(response);
  }

  return { call, read, send };
}
