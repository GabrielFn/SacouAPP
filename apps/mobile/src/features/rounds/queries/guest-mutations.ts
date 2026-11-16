import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { AddGuestBody, SacouApi } from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  settleCacheEffects,
  type CacheEffect,
} from "../../../services/query/invalidation";
import { queryKeys } from "../../../services/query/query-keys";
import type { AddedGuest } from "../model/add-player.reducer";
import { attendanceRefusedEffects, roundScope } from "./round-mutations";

/** A new member and a new place: the member list and the round are read again. */
function guestAddedEffects(groupId: string, roundId: string): readonly CacheEffect[] {
  return [
    { action: "invalidate", key: queryKeys.members(groupId) },
    ...cacheEffectsOf({ type: "attendanceChanged", groupId, roundId }),
  ];
}

/**
 * A refusal may come after the guest was created (ADR 0053, D4): the member list is read again so the
 * guest shows on screen 21, plus what the refusal itself makes stale.
 */
export function guestRefusedEffects(
  groupId: string,
  roundId: string,
  error: unknown,
): readonly CacheEffect[] {
  if (apiErrorOf(error)?.kind !== "problem") return [];
  return [
    { action: "invalidate", key: queryKeys.members(groupId) },
    ...attendanceRefusedEffects(groupId, roundId, error),
  ];
}

/**
 * "Adicionar à rodada" of the sheet 21a: two calls, never one inside the other (ADR 0053, D4). First the
 * guest joins the group by its `requestId` (the same one answers the same `memberId`), then it goes on the
 * list as any member marked by the admin. Trying again repeats both, and both are idempotent.
 */
export function addGuestMutation(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  roundId: string,
) {
  return {
    scope: roundScope(roundId),
    mutationFn: async (body: AddGuestBody): Promise<AddedGuest> => {
      const { memberId } = await unwrap(api.addGuest(groupId, body));
      const ref = { groupId, roundId, memberId };
      const answer = await unwrap(api.setMemberAttendance(ref, "going"));
      return { memberId, answer };
    },
    // Returned: "Adicionando…" lasts until the list shows the guest.
    onSuccess: () => settleCacheEffects(client, guestAddedEffects(groupId, roundId)),
    onError: (error: unknown) => {
      applyCacheEffects(client, guestRefusedEffects(groupId, roundId, error));
    },
  };
}
