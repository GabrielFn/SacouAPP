import { failureOf } from "../round-page/api-failures";
import type { ApiOutcome, ApiPort } from "../round-page/ports";
import type { AttendanceStatus, Intent, Standing } from "../round-page/round-page.types";

/** The parts of `fetch` the adapter uses, so a test hands a fake. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface FetchApiOptions {
  readonly fetch: FetchLike;
  readonly idToken: () => Promise<string | null>;
}

const HTTP_NOT_FOUND = 404;

const STATUSES: readonly AttendanceStatus[] = ["going", "notGoing", "waitlisted", "promoted"];

interface Resolved {
  readonly isOpen: boolean;
  readonly groupId: string | null;
  readonly roundId: string | null;
  readonly isMember: boolean;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function statusOf(value: unknown): AttendanceStatus | null {
  return STATUSES.find((status) => status === value) ?? null;
}

function positionOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** The status and the place of an answer (`RoundLinkAnswerResponse`) or of the round's `me`. */
function standingOf(body: unknown): Standing | null {
  if (!isRecord(body)) return null;
  const status = statusOf(body.status);
  return status === null ? null : { status, position: positionOf(body.position) };
}

function resolvedOf(body: unknown): Resolved | null {
  if (!isRecord(body) || typeof body.isOpen !== "boolean" || typeof body.isMember !== "boolean") return null;
  const id = (value: unknown) => (typeof value === "string" ? value : null);
  return { isOpen: body.isOpen, groupId: id(body.groupId), roundId: id(body.roundId), isMember: body.isMember };
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

async function refusal(response: Response): Promise<ApiOutcome<never>> {
  const body = await bodyOf(response);
  const code = isRecord(body) && typeof body.code === "string" ? body.code : null;
  const joined = isRecord(body) && typeof body.joined === "boolean" ? body.joined : null;
  const retryAfter = response.headers.get("Retry-After");
  return { ok: false, failure: failureOf({ status: response.status, code, retryAfter, joined }) };
}

/** No request left: no connection, or no session to sign it with. */
type NoResponse = "offline" | "signedOut";

function lost(reason: NoResponse): ApiOutcome<never> {
  return reason === "offline" ? offline : unexpected;
}

/** The Sacou API on the page's own origin: JSON bodies, the ID token in `Authorization`, never a cookie (ADR 0070, D4). */
export function createFetchApi(options: FetchApiOptions): ApiPort {
  async function call(method: string, path: string, body?: unknown): Promise<Response | NoResponse> {
    const token = await options.idToken();
    if (token === null) return "signedOut";
    const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const init: RequestInit = { method, credentials: "omit", cache: "no-store", redirect: "error" };
    const request: RequestInit =
      body === undefined
        ? { ...init, headers: auth }
        : { ...init, headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) };
    try {
      return await options.fetch(path, request);
    } catch {
      return "offline";
    }
  }

  async function read<T>(response: Response | NoResponse, parse: (body: unknown) => T | null): Promise<ApiOutcome<T>> {
    if (typeof response === "string") return lost(response);
    if (!response.ok) return refusal(response);
    const value = parse(await bodyOf(response));
    return value === null ? unexpected : { ok: true, value };
  }

  async function standing(code: string): Promise<ApiOutcome<Standing | null>> {
    const resolved = await read(await call("POST", "/v1/round-links/resolve", { code }), resolvedOf);
    if (!resolved.ok) return resolved;
    const { isOpen, isMember, groupId, roundId } = resolved.value;
    if (!isOpen || !isMember || groupId === null || roundId === null) return { ok: true, value: null };
    const round = await read(await call("GET", `/v1/groups/${groupId}/rounds/${roundId}`), (body) =>
      isRecord(body) ? { me: standingOf(body.me) } : null,
    );
    return round.ok ? { ok: true, value: round.value.me } : round;
  }

  async function register(): Promise<ApiOutcome<{ readonly hasProfile: boolean }>> {
    const signIn = await call("POST", "/v1/me");
    if (typeof signIn === "string") return lost(signIn);
    if (!signIn.ok) return refusal(signIn);
    const profile = await call("GET", "/v1/me/profile");
    if (typeof profile === "string") return lost(profile);
    if (profile.status === HTTP_NOT_FOUND) return { ok: true, value: { hasProfile: false } };
    return profile.ok ? { ok: true, value: { hasProfile: true } } : refusal(profile);
  }

  async function saveNickname(nickname: string): Promise<ApiOutcome<null>> {
    const body = { nickname, primaryPosition: null, otherPositions: null, suggestedLevel: null };
    const response = await call("PUT", "/v1/me/profile", body);
    if (typeof response === "string") return lost(response);
    return response.ok ? { ok: true, value: null } : refusal(response);
  }

  return {
    register,
    saveNickname,
    answer: async (code: string, intent: Intent) =>
      read(await call("POST", "/v1/round-links/attendance", { code, response: intent }), standingOf),
    standing,
  };
}
