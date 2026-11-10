import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../api/api-error";
import { groupIdOf, queryKeys, type SacouQueryKey } from "./query-keys";

/** A mutation that went through, as the cache needs to know it (D6). */
export type MutationEvent =
  | { readonly type: "createGroup" | "acceptInvite" }
  | { readonly type: "renameGroup" | "leaveGroup"; readonly groupId: string }
  | { readonly type: "createInvite" | "revokeInvite"; readonly groupId: string }
  | {
      readonly type: "changeMemberRole" | "changeMemberType" | "removeMember";
      readonly groupId: string;
      /** The caller changed itself: its own role or type in the list of groups changed too. */
      readonly targetIsMe: boolean;
    };

export interface CacheEffect {
  readonly action: "invalidate" | "remove";
  readonly key: SacouQueryKey;
}

const invalidate = (key: SacouQueryKey): CacheEffect => ({ action: "invalidate", key });
const remove = (key: SacouQueryKey): CacheEffect => ({ action: "remove", key });

/** What each mutation makes stale, pure and tested as a golden table (P5). */
export function cacheEffectsOf(event: MutationEvent): readonly CacheEffect[] {
  switch (event.type) {
    case "createGroup":
    case "acceptInvite":
      return [invalidate(queryKeys.groups())];
    case "renameGroup":
      return [invalidate(queryKeys.group(event.groupId)), invalidate(queryKeys.groups())];
    case "leaveGroup":
      return [remove(queryKeys.group(event.groupId)), invalidate(queryKeys.groups())];
    case "createInvite":
    case "revokeInvite":
      return [invalidate(queryKeys.invites(event.groupId))];
    case "changeMemberRole":
    case "changeMemberType":
    case "removeMember":
      return event.targetIsMe
        ? [invalidate(queryKeys.members(event.groupId)), invalidate(queryKeys.groups())]
        : [invalidate(queryKeys.members(event.groupId))];
  }
}

const CONFLICT = 409;

/** A 409 shows its text and refreshes the resource, so the screen shows the state that won (D5). */
export function isConflict(error: unknown): boolean {
  const apiError = apiErrorOf(error);
  return apiError?.kind === "problem" && apiError.status === CONFLICT;
}

/**
 * A group that is gone for this person (removed, or left on another phone) leaves the cache, the persisted
 * one included, and the list is fetched again (D5).
 */
export function groupGoneEffects(key: SacouQueryKey, error: unknown): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  const groupId = groupIdOf(key);
  const gone = apiError?.kind === "problem" && apiError.code === "groups.group-not-found";
  return gone && groupId !== null
    ? [remove(queryKeys.group(groupId)), invalidate(queryKeys.groups())]
    : [];
}

export function applyCacheEffects(client: QueryClient, effects: readonly CacheEffect[]): void {
  effects.forEach(({ action, key }) => {
    if (action === "remove") client.removeQueries({ queryKey: key });
    else void client.invalidateQueries({ queryKey: key });
  });
}
