import type { MyGroup } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { tapTarget } from "../model/notification-tap";
import { markNotificationRead, type NotificationReadDeps } from "./notification-queries";

/** Where a touched push can lead: the screens are the hook's, this only picks one. */
export interface TapRouting {
  openRound(groupId: string, roundId: string): void;
  openHome(): void;
}

function knownGroupIds(deps: NotificationReadDeps): ReadonlySet<string> | null {
  const groups = deps.client.getQueryData<readonly MyGroup[]>(queryKeys.groups());
  return groups === undefined ? null : new Set(groups.map((group) => group.groupId));
}

/**
 * A touched push (app open, in the background or closed): the round of a valid one, marked as read;
 * the home for anything else (section 6, T). The list is read again either way.
 */
export function handleNotificationTap(
  deps: NotificationReadDeps,
  routing: TapRouting,
  data: unknown,
): void {
  const target = tapTarget(data, knownGroupIds(deps));
  switch (target.kind) {
    case "round":
      routing.openRound(target.groupId, target.roundId);
      void markNotificationRead(deps, target.notificationId);
      return;
    case "home":
      routing.openHome();
      void deps.client.invalidateQueries({ queryKey: queryKeys.notifications() });
      return;
  }
}

/** A push with the app in front: the system shows the banner; the list and the dot are read again. */
export function handlePushReceived(deps: Pick<NotificationReadDeps, "client">): void {
  void deps.client.invalidateQueries({ queryKey: queryKeys.notifications() });
}
