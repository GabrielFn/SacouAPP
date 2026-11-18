import type { QueryClient } from "@tanstack/react-query";

import { positionsOf } from "../features/draw/model/default-lineup";
import type { CourtRoundSource } from "../features/court/ports/court-round-source";
import { roundSettingsOf } from "../features/rounds/model/round-detail";
import type { Member, Round } from "../services/api/sacou-api";
import { queryKeys } from "../services/query/query-keys";

/**
 * The round and the members of the session's group from the TanStack cache, persisted for offline
 * (E4.2): the screen opened before the court already loaded them. Missing data reads as no round.
 */
export function createCachedCourtRoundSource(client: QueryClient): CourtRoundSource {
  return {
    read({ groupId, roundId }) {
      const round = client.getQueryData<Round>(queryKeys.round(groupId, roundId));
      const members = client.getQueryData<readonly Member[]>(queryKeys.members(groupId)) ?? [];
      return {
        settings: round === undefined ? null : (roundSettingsOf(round)?.values ?? null),
        confirmed: round?.going ?? [],
        positionOf: positionsOf(members),
      };
    },
  };
}
