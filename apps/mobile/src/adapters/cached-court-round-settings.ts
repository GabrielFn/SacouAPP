import type { QueryClient } from "@tanstack/react-query";

import type { CourtSessionOrigin } from "../features/court/ports/court-event-log";
import type { CourtRoundSettings } from "../features/court/ports/court-round-settings";
import { roundSettingsOf } from "../features/rounds/model/round-detail";
import type { Round } from "../services/api/sacou-api";
import { queryKeys } from "../services/query/query-keys";

/**
 * The settings of the round from the TanStack cache, persisted for the week (E4.2), so the court reads
 * them with no network. The value is read on each call: the cache is the one source.
 */
export function createCachedCourtRoundSettings(client: QueryClient): CourtRoundSettings {
  return {
    individualPoints: ({ groupId, roundId }: CourtSessionOrigin) => {
      const round = client.getQueryData<Round>(queryKeys.round(groupId, roundId));
      return round === undefined
        ? false
        : (roundSettingsOf(round)?.values.mvp.individualPoints ?? false);
    },
  };
}
