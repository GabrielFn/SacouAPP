import { queryOptions } from "@tanstack/react-query";

import { ApiFailure } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { toSettingsView, type GroupSettingsView } from "../model/settings-document";
import { GROUP_STALE_MS } from "./group-queries";

/** A document the engine's parser refuses is not shown and not kept: it reads as an unexpected answer. */
const UNPARSEABLE = { kind: "unexpected", status: 0 } as const;

export function viewOrThrow(document: Parameters<typeof toSettingsView>[0]): GroupSettingsView {
  const view = toSettingsView(document);
  if (view === null) throw new ApiFailure(UNPARSEABLE);
  return view;
}

export function groupSettingsQuery(api: SacouApi, groupId: string) {
  return queryOptions({
    queryKey: queryKeys.settings(groupId),
    queryFn: async () => viewOrThrow(await unwrap(api.getGroupSettings(groupId))),
    staleTime: GROUP_STALE_MS,
  });
}

/** Only for who manages the settings: the others would get a 403, so the screen turns it off. */
export function groupTemplatesQuery(api: SacouApi, groupId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.templates(groupId),
    queryFn: () => unwrap(api.listTemplates(groupId)),
    staleTime: GROUP_STALE_MS,
    enabled,
  });
}
