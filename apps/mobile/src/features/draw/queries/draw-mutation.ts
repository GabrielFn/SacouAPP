import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { DrawTeamsAnswer, DrawTeamsBody, SacouApi } from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  type CacheEffect,
} from "../../../services/query/invalidation";
import { queryKeys } from "../../../services/query/query-keys";

const FORBIDDEN_STATUS = 403;

/** One draw at a time per round: a second tap waits for the first (D10). */
export function drawScope(roundId: string): { readonly id: string } {
  return { id: `draw:${roundId}` };
}

/**
 * The answer goes straight to `deliver` (the reducer) and the mutation keeps `null`: the levels of
 * everyone never sit in the `MutationCache`, which `gcTime: 0` also empties when the screen leaves.
 */
export interface DrawVariables {
  readonly body: DrawTeamsBody;
  readonly deliver: (answer: DrawTeamsAnswer) => void;
}

/**
 * A refused draw reads the round again (someone left, the round closed, the draw was turned off); a 403
 * also reads the group, whose role is stale (D1).
 */
export function drawRefusedEffects(
  groupId: string,
  roundId: string,
  error: unknown,
): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  if (apiError?.kind !== "problem") return [];
  const round: CacheEffect = { action: "invalidate", key: queryKeys.round(groupId, roundId) };
  return apiError.status === FORBIDDEN_STATUS
    ? [...cacheEffectsOf({ type: "settingsForbidden", groupId }), round]
    : [round];
}

export function drawMutation(api: SacouApi, client: QueryClient, groupId: string, roundId: string) {
  return {
    scope: drawScope(roundId),
    gcTime: 0,
    mutationFn: async ({ body, deliver }: DrawVariables): Promise<null> => {
      deliver(await unwrap(api.drawTeams(groupId, roundId, body)));
      return null;
    },
    onError: (error: unknown) => {
      applyCacheEffects(client, drawRefusedEffects(groupId, roundId, error));
    },
  };
}
