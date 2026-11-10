import { errorTextOf } from "../../../services/api/api-error-text";
import { useOnline } from "../../../services/api/use-online";
import { wallClockNow } from "../../../services/api/wall-clock";
import { offlineBannerText } from "../../../services/query/staleness";
import type { PendingLeaves } from "../model/group-settings-form.reducer";
import { canManageSettings } from "../model/group-settings.selectors";
import { settingsReady, type SettingsReady } from "../model/settings-screen-state";
import { useGroup, useGroupSettings, useGroupTemplates } from "../queries/use-group-queries";

export interface SettingsData {
  /** `null` while loading, or when there is nothing to show (see `failure`). */
  readonly ready: SettingsReady | null;
  readonly failure: { readonly text: string } | null;
  readonly bannerText: string | null;
  readonly retry: () => void;
}

/** The three queries of screen 18 put together: the group, its settings and (for admins) its templates. */
export function useSettingsData(groupId: string, pending: PendingLeaves): SettingsData {
  const online = useOnline();
  const group = useGroup(groupId);
  const settings = useGroupSettings(groupId);
  const manages = group.data !== undefined && canManageSettings(group.data.role);
  const templates = useGroupTemplates(groupId, manages);
  const ready = settingsReady(group.data, settings.data, pending, templates.data ?? []);
  const failed = group.error ?? settings.error;
  return {
    ready,
    failure: ready === null && failed !== null ? { text: errorTextOf(failed) } : null,
    bannerText: offlineBannerText({
      online,
      dataUpdatedAt: settings.dataUpdatedAt,
      now: wallClockNow(),
    }),
    retry: () => {
      void group.refetch();
      void settings.refetch();
    },
  };
}
