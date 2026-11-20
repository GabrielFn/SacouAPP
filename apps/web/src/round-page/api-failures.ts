import type { Failure } from "./round-page.types";

/** What the page reads of a refused answer: the status, the `code` of the ProblemDetails, `Retry-After` and `joined`. */
export interface RefusedAnswer {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfter: string | null;
  readonly joined: boolean | null;
}

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_GONE = 410;
const HTTP_SERVICE_UNAVAILABLE = 503;
const DEFAULT_RETRY_SECONDS = 1;

/** The codes of the API that the page explains with their own words. The rest is `unexpected`. */
const BY_CODE: Readonly<Record<string, (joined: boolean) => Failure>> = {
  "api.rate-limited": () => ({ kind: "rateLimited", retryAfterSeconds: DEFAULT_RETRY_SECONDS }),
  "sessions.round-link-invalid": () => ({ kind: "linkInvalid" }),
  "groups.invite-invalid": () => ({ kind: "inviteInvalid" }),
  "sessions.round-closed": () => ({ kind: "roundClosed" }),
  "groups.member-removed": () => ({ kind: "removed" }),
  "groups.member-limit": () => ({ kind: "groupFull" }),
  "groups.membership-limit": () => ({ kind: "groupFull" }),
  "identity.account-deleted": () => ({ kind: "accountDeleted" }),
  "identity.nickname-invalid": () => ({ kind: "nicknameInvalid" }),
  "sessions.drop-in-window-closed": (joined) => ({ kind: "dropInWindowClosed", joined }),
  "sessions.round-full": (joined) => ({ kind: "roundFull", joined }),
};

function retrySeconds(header: string | null): number {
  const seconds = header === null ? Number.NaN : Number.parseInt(header, 10);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_SECONDS;
}

/** A refused answer of the API, as the page explains it. */
export function failureOf(refused: RefusedAnswer): Failure {
  if (refused.status === HTTP_TOO_MANY_REQUESTS) {
    return { kind: "rateLimited", retryAfterSeconds: retrySeconds(refused.retryAfter) };
  }
  if (refused.status === HTTP_SERVICE_UNAVAILABLE) return { kind: "offline" };
  if (refused.status === HTTP_GONE) return { kind: "accountDeleted" };
  const byCode = refused.code === null ? undefined : BY_CODE[refused.code];
  return byCode === undefined ? { kind: "unexpected" } : byCode(refused.joined === true);
}
