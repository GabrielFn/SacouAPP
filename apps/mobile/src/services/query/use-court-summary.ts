import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "./query-keys";

/** Fresh for a moment: the 06 or the 08 read it just before opening the 09a, which reuses it. */
export const COURT_SUMMARY_STALE_MS = 5_000;
/** Gone soon after nobody shows it: it says who marks the court now, and it ages fast. */
export const COURT_SUMMARY_GC_MS = 30_000;

export interface CourtSummaryOrigin {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * The summary of the court of a round (E4.11, D5), read with the reader the court passes in, which
 * answers a value and never throws. Its key is outside the persisted allow list (`isPersistedKey`):
 * who marks the court is never on disk.
 */
export function courtSummaryQuery<Lookup>(
  { groupId, roundId }: CourtSummaryOrigin,
  read: () => Promise<Lookup>,
) {
  return queryOptions({
    queryKey: queryKeys.courtSummary(groupId, roundId),
    queryFn: read,
    staleTime: COURT_SUMMARY_STALE_MS,
    gcTime: COURT_SUMMARY_GC_MS,
    retry: false,
  });
}

export interface CourtSummaryRead<Lookup> {
  /** `undefined` before the first answer, or while offline (the query waits for the network). */
  readonly lookup: Lookup | undefined;
  readonly fetching: boolean;
  /** Reads it again now, whatever its age; resolves with what it read. */
  readonly refresh: () => Promise<Lookup | undefined>;
}

export function useCourtSummary<Lookup>(
  origin: CourtSummaryOrigin,
  read: () => Promise<Lookup>,
  enabled: boolean,
): CourtSummaryRead<Lookup> {
  const query = useQuery({ ...courtSummaryQuery(origin, read), enabled });
  const { refetch } = query;
  const refresh = useCallback(async () => (await refetch()).data, [refetch]);
  return { lookup: query.data, fetching: query.isFetching, refresh };
}
