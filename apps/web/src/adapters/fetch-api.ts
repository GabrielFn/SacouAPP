import type { ApiOutcome, ApiPort } from "../round-page/ports";
import type { AttendanceStatus, Intent, Standing } from "../round-page/round-page.types";

import { createApiClient, isRecord, lost, refusal, type FetchApiOptions } from "./api-client";

export type { FetchApiOptions, FetchLike } from "./api-client";

const HTTP_NOT_FOUND = 404;

const STATUSES: readonly AttendanceStatus[] = ["going", "notGoing", "waitlisted", "promoted"];

interface Resolved {
  readonly isOpen: boolean;
  readonly groupId: string | null;
  readonly roundId: string | null;
  readonly isMember: boolean;
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
  if (!isRecord(body) || typeof body.isOpen !== "boolean" || typeof body.isMember !== "boolean")
    return null;
  const id = (value: unknown) => (typeof value === "string" ? value : null);
  return {
    isOpen: body.isOpen,
    groupId: id(body.groupId),
    roundId: id(body.roundId),
    isMember: body.isMember,
  };
}

/** The round page's calls (ADR 0070, D3 and D4), through the shared client of the API. */
export function createFetchApi(options: FetchApiOptions): ApiPort {
  const { call, read, send } = createApiClient(options);

  async function standing(code: string): Promise<ApiOutcome<Standing | null>> {
    const resolved = await read(
      await call("POST", "/v1/round-links/resolve", { code }),
      resolvedOf,
    );
    if (!resolved.ok) return resolved;
    const { isOpen, isMember, groupId, roundId } = resolved.value;
    if (!isOpen || !isMember || groupId === null || roundId === null)
      return { ok: true, value: null };
    const round = await read(
      await call("GET", `/v1/groups/${groupId}/rounds/${roundId}`),
      (body) => (isRecord(body) ? { me: standingOf(body.me) } : null),
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
    return send("PUT", "/v1/me/profile", body);
  }

  return {
    register,
    saveNickname,
    answer: async (code: string, intent: Intent) =>
      read(
        await call("POST", "/v1/round-links/attendance", { code, response: intent }),
        standingOf,
      ),
    standing,
  };
}
