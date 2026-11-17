import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type {
  AttendanceAnswer,
  AttendanceResponse,
  CreateRoundBody,
  Round,
  SacouApi,
  UpdateRoundBody,
} from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  isConflict,
  settleCacheEffects,
  type CacheEffect,
} from "../../../services/query/invalidation";
import { queryKeys } from "../../../services/query/query-keys";

/** One queue per round: two answers in a row go to the server in order (ADR 0054, D3). */
export function roundScope(roundId: string): { readonly id: string } {
  return { id: `round:${roundId}` };
}

/** One queue per group for the creation, so a double tap makes one call after the other, never two at once. */
export function createRoundScope(groupId: string): { readonly id: string } {
  return { id: `rounds:${groupId}` };
}

/** The answer is the whole round: it fills the detail and the list is read again. */
export function createRoundMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    scope: createRoundScope(groupId),
    mutationFn: (body: CreateRoundBody) => unwrap(api.createRound(groupId, body)),
    onSuccess: (round: { readonly roundId: string }) => {
      applyCacheEffects(
        client,
        cacheEffectsOf({ type: "roundCreated", groupId, roundId: round.roundId, round }),
      );
    },
  };
}

const FORBIDDEN_STATUS = 403;

/**
 * What a command on a round refused by the server reads again: a 403 the group and its role, and the round;
 * any other refusal the round only when `readsRound` says so. No answer at all (offline) reads nothing.
 */
export function roundRefusedEffects(
  groupId: string,
  roundId: string,
  error: unknown,
  readsRound: (error: unknown) => boolean,
): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  if (apiError?.kind !== "problem") return [];
  const round: CacheEffect = { action: "invalidate", key: queryKeys.round(groupId, roundId) };
  if (apiError.status === FORBIDDEN_STATUS) {
    return [...cacheEffectsOf({ type: "settingsForbidden", groupId }), round];
  }
  return readsRound(error) ? [round] : [];
}

/**
 * A refused edit reads again what it was refused against: a 403 the group and its role, a 409 (`round-closed`,
 * `round-date-taken`) the round. The text comes from the error.
 */
export function roundEditRefusedEffects(
  groupId: string,
  roundId: string,
  error: unknown,
): readonly CacheEffect[] {
  return roundRefusedEffects(groupId, roundId, error, isConflict);
}

/** "Salvar" of "Editar rodada": the answer is the whole round, which replaces the cached detail. */
export function updateRoundMutation(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  roundId: string,
) {
  return {
    scope: roundScope(roundId),
    mutationFn: (body: UpdateRoundBody) => unwrap(api.updateRound(groupId, roundId, body)),
    onSuccess: (round: Round) => {
      applyCacheEffects(client, cacheEffectsOf({ type: "roundUpdated", groupId, roundId, round }));
    },
    onError: (error: unknown) => {
      applyCacheEffects(client, roundEditRefusedEffects(groupId, roundId, error));
    },
  };
}

const MEMBER_GONE: ReadonlySet<string> = new Set([
  "sessions.member-not-found",
  "groups.member-not-found",
]);

/**
 * A refused answer shows its text and reads again what it was refused against: a 409 (`round-full`,
 * `drop-in-window-closed`, `round-closed`...) the round, a member that is gone the member list (D3). A 403
 * means the role on the phone is stale: the group (and its role) and the round are read again, and the
 * screens that need `ManageRounds` go back to the round by themselves.
 */
export function attendanceRefusedEffects(
  groupId: string,
  roundId: string,
  error: unknown,
): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  if (apiError?.kind !== "problem") return [];
  if (apiError.status === FORBIDDEN_STATUS) {
    return [
      ...cacheEffectsOf({ type: "settingsForbidden", groupId }),
      ...cacheEffectsOf({ type: "attendanceChanged", groupId, roundId }),
    ];
  }
  if (MEMBER_GONE.has(apiError.code)) {
    return [{ action: "invalidate", key: queryKeys.members(groupId) }];
  }
  return isConflict(error) ? cacheEffectsOf({ type: "attendanceChanged", groupId, roundId }) : [];
}

function attendanceEffects(client: QueryClient, groupId: string, roundId: string) {
  return {
    // Returned, so the call stays pending until the round is read again ("Adicionando…" lasts until then).
    onSuccess: () =>
      settleCacheEffects(client, cacheEffectsOf({ type: "attendanceChanged", groupId, roundId })),
    onError: (error: unknown) => {
      applyCacheEffects(client, attendanceRefusedEffects(groupId, roundId, error));
    },
  };
}

/** "VOU", "Não vou", "Não vou mais" and "Sair da espera" of screen 26. */
export function respondAttendanceMutation(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  roundId: string,
) {
  return {
    scope: roundScope(roundId),
    mutationFn: (response: AttendanceResponse) =>
      unwrap(api.respondAttendance(groupId, roundId, response)),
    ...attendanceEffects(client, groupId, roundId),
  };
}

export interface MemberAttendance {
  readonly memberId: string;
  readonly response: AttendanceResponse;
}

export interface MemberAttendanceResult extends MemberAttendance {
  readonly answer: AttendanceAnswer;
}

/**
 * "Adicionar" of screen 21 and "Tirar" of the list: an admin marks someone else. The server checks the
 * permission and decides the place; the app sends only IDs (ADR 0054).
 */
export function setMemberAttendanceMutation(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  roundId: string,
) {
  return {
    scope: roundScope(roundId),
    mutationFn: async (change: MemberAttendance): Promise<MemberAttendanceResult> => {
      const ref = { groupId, roundId, memberId: change.memberId };
      const answer = await unwrap(api.setMemberAttendance(ref, change.response));
      return { ...change, answer };
    },
    ...attendanceEffects(client, groupId, roundId),
  };
}
