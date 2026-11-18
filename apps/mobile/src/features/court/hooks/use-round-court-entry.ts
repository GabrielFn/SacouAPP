import { useRouter } from "expo-router";
import { useCallback } from "react";

import { useOnline } from "../../../services/api/use-online";
import { courtHref, takeOverHref } from "../navigation";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { opensTakeover } from "../takeover/court-summary-lookup";
import { useCourtSummaryLookup } from "./use-court-summary-lookup";
import { useRoundCourt } from "./use-round-court";

export interface RoundCourtEntry {
  /** "Abrir quadra" shows: a session of the round on this phone, or a stream on the server (D5). */
  readonly available: boolean;
  /** Reads the summary again (with a network) and opens the 09a or the court. */
  readonly open: () => void;
}

/**
 * "Abrir quadra" of screen 06 (E4.11, D5, case a): with a network the summary is read first, and the
 * 09a comes when this phone does not write the stream of the round; offline or with no stream, the
 * court of this phone opens as before.
 */
export function useRoundCourtEntry(origin: CourtSessionOrigin, enabled: boolean): RoundCourtEntry {
  const router = useRouter();
  const online = useOnline();
  const read = useRoundCourt(origin.roundId);
  const court = read.status === "read" ? read.court : null;
  const summary = useCourtSummaryLookup(origin, enabled && online);
  const { refresh } = summary;
  const open = useCallback(() => {
    void (async () => {
      const lookup = online ? await refresh() : undefined;
      if (opensTakeover(lookup, court)) {
        router.push(takeOverHref(origin));
      } else if (court !== null) {
        router.push(courtHref("court", { courtSessionId: court.courtSessionId }));
      }
    })();
  }, [online, refresh, court, router, origin]);
  return {
    available: court !== null || (enabled && summary.lookup?.status === "found"),
    open,
  };
}
