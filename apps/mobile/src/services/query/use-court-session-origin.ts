import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

/**
 * Where a court session came from, fetched once per session with the reader the court passes in. The
 * court slice is offline by design and keeps TanStack out, so the cache hook lives here. The key is
 * outside the persisted allow list: it is read from the court log again on the next launch.
 */
export function useCourtSessionOrigin<Origin>(
  courtSessionId: string,
  read: () => Promise<Origin | null>,
): Origin | null | undefined {
  return useQuery({
    queryKey: queryKeys.courtSessionOrigin(courtSessionId),
    queryFn: read,
    staleTime: Infinity,
  }).data;
}
