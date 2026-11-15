import type { QueryClient } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { CreateRoundBody, SacouApi } from "../../../services/api/sacou-api";
import { applyCacheEffects, cacheEffectsOf } from "../../../services/query/invalidation";

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
