import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

const MS_PER_MINUTE = 60_000;
const FRESH_MINUTES = 5;
/** The config changes with a deploy: five minutes is fresh, and it is read again when the app comes back. */
export const APP_CONFIG_STALE_MS = FRESH_MINUTES * MS_PER_MINUTE;

/** The one record of the minimum build and the flags (ADR 0084): persisted, so a known answer holds offline. */
export function appConfigQuery(api: SacouApi) {
  return queryOptions({
    queryKey: queryKeys.appConfig(),
    queryFn: () => unwrap(api.getAppConfig()),
    staleTime: APP_CONFIG_STALE_MS,
    refetchOnWindowFocus: true,
  });
}
