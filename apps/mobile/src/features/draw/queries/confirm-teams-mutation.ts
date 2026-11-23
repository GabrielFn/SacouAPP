import type { QueryClient } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { ConfirmTeamsBody, Round, SacouApi } from "../../../services/api/sacou-api";
import { applyCacheEffects, cacheEffectsOf } from "../../../services/query/invalidation";
import { drawScope } from "./draw-mutation";

/** One quick retry for a blip of the network; the WhatsApp text already went, so no more (question 182). */
export const CONFIRM_TEAMS_RETRIES = 1;

/**
 * Publishes the teams (R100, ADR 0078) in the queue of the draw, so it never crosses a "Sortear de novo". The
 * answer is the whole round, which replaces the cached detail: screens 26 and 06 show the teams without a read.
 * A failure is only the mutation's `isError` (frontend.md, rule 1): the flow of screen 07 goes on.
 */
export function confirmTeamsMutation(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  roundId: string,
) {
  return {
    scope: drawScope(roundId),
    gcTime: 0,
    retry: CONFIRM_TEAMS_RETRIES,
    mutationFn: (body: ConfirmTeamsBody): Promise<Round> =>
      unwrap(api.confirmTeams(groupId, roundId, body)),
    onSuccess: (round: Round) => {
      applyCacheEffects(client, cacheEffectsOf({ type: "roundUpdated", groupId, roundId, round }));
    },
  };
}
