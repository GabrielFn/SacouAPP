import type { QueryClient } from "@tanstack/react-query";

import { ApiFailure, apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { MemberLevelItem, SacouApi } from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  type CacheEffect,
} from "../../../services/query/invalidation";
import { queryKeys } from "../../../services/query/query-keys";
import { inBatches } from "../model/member-levels";

export interface LevelMutationDeps {
  readonly api: SacouApi;
  readonly client: QueryClient;
}

/** One queue per group: an old answer never lands after a newer one (as the settings, ADR 0049). */
function levelsScope(groupId: string): { readonly id: string } {
  return { id: `levels-${groupId}` };
}

/**
 * A refused level makes the levels stale; a 403 also makes the role stale (the person stopped being an
 * admin), so the screen hides the levels by itself. Nothing of the level goes to a log.
 */
export function levelRefusedEffects(groupId: string, error: unknown): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  const forbidden = apiError?.kind === "problem" && apiError.code === "groups.forbidden";
  const levels = cacheEffectsOf({ type: "memberLevelsChanged", groupId });
  return forbidden ? [...levels, { action: "invalidate", key: queryKeys.group(groupId) }] : levels;
}

export function setLevelMutation(deps: LevelMutationDeps, groupId: string) {
  return {
    scope: levelsScope(groupId),
    gcTime: 0,
    mutationFn: async (item: MemberLevelItem) => {
      await unwrap(deps.api.setMemberLevel({ groupId, memberId: item.memberId }, item.level));
      return item;
    },
    onSuccess: () => {
      applyCacheEffects(deps.client, cacheEffectsOf({ type: "memberLevelsChanged", groupId }));
    },
    onError: (error: unknown) => {
      applyCacheEffects(deps.client, levelRefusedEffects(groupId, error));
    },
  };
}

/** What "Confirmar todas" got through: who went in, and how many did not. */
export interface ConfirmAllOutcome {
  readonly sent: readonly string[];
  readonly failed: number;
  /** The first refusal, for its text; `null` when everything went in. */
  readonly error: unknown;
}

/**
 * "Confirmar todas" (19b): the batch route, all or nothing, 50 members at a time. A refused batch keeps
 * its cards; the batches that went in leave the list when the levels are read again.
 */
export async function confirmAll(
  api: SacouApi,
  groupId: string,
  items: readonly MemberLevelItem[],
): Promise<ConfirmAllOutcome> {
  const empty: ConfirmAllOutcome = { sent: [], failed: 0, error: null };
  return inBatches(items).reduce<Promise<ConfirmAllOutcome>>(async (previous, batch) => {
    const done = await previous;
    const result = await api.setMemberLevels(groupId, batch);
    return result.ok
      ? { ...done, sent: [...done.sent, ...batch.map((item) => item.memberId)] }
      : {
          ...done,
          failed: done.failed + batch.length,
          error: done.error ?? new ApiFailure(result.error),
        };
  }, Promise.resolve(empty));
}

export function confirmAllMutation(deps: LevelMutationDeps, groupId: string) {
  return {
    scope: levelsScope(groupId),
    gcTime: 0,
    mutationFn: (items: readonly MemberLevelItem[]) => confirmAll(deps.api, groupId, items),
    onSettled: (outcome: ConfirmAllOutcome | undefined, error: unknown) => {
      const refusal = error ?? outcome?.error ?? null;
      applyCacheEffects(
        deps.client,
        refusal === null
          ? cacheEffectsOf({ type: "memberLevelsChanged", groupId })
          : levelRefusedEffects(groupId, refusal),
      );
    },
  };
}
