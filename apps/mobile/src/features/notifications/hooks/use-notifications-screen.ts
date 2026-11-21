import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer } from "react";

import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { notificationsView, type NotificationsView } from "../model/notifications-view";
import {
  activationOf,
  INITIAL_PUSH_PERMISSION,
  pushPermissionReducer,
} from "../model/push-permission.reducer";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQuery,
} from "../queries/notification-queries";

export interface NotificationsScreenModel {
  readonly view: NotificationsView;
  /** "Ativar": the system question, or the settings of the phone when refused for good. */
  readonly activate: () => void;
  readonly markAllRead: () => void;
  readonly markRead: (notificationId: string) => void;
  readonly retry: () => void;
}

/**
 * Screen 28: the list from the cache (the one record), the card from the reducer of the permission,
 * read again when the app comes back from the settings. Given the permission, the phone registers.
 */
export function useNotificationsScreen(): NotificationsScreenModel {
  const { sacouApi, notificationPermission, appForeground, pushDevices } = useServices();
  const client = useQueryClient();
  const query = useQuery(notificationsQuery(sacouApi));
  const [permission, send] = useReducer(pushPermissionReducer, INITIAL_PUSH_PERMISSION);

  useEffect(() => {
    const alive = { value: true };
    const read = () => {
      void notificationPermission.status().then((answer) => {
        if (alive.value) send({ type: "status-read", answer });
        if (answer === "granted") void pushDevices.sync();
      });
    };
    read();
    const stop = appForeground.subscribe(read);
    return () => {
      alive.value = false;
      stop();
    };
  }, [notificationPermission, appForeground, pushDevices]);

  const view = notificationsView(
    {
      status: query.status,
      fetchStatus: query.fetchStatus,
      data: query.data,
      error: query.error,
    },
    permission,
    { nowMs: wallClockNow(), offsetMinutes: new Date().getTimezoneOffset() },
  );
  const deps = { api: sacouApi, client };

  return {
    view,
    activate: () => {
      switch (activationOf(permission)) {
        case "request":
          send({ type: "request-started" });
          // A request the system fails counts as not answered: the card goes back to askable.
          void notificationPermission.request().then(
            (answer) => {
              send({ type: "request-answered", answer });
              if (answer === "granted") void pushDevices.sync();
            },
            () => {
              send({ type: "request-answered", answer: "askable" });
            },
          );
          return;
        case "open-settings":
          void notificationPermission.openSettings();
          return;
        case "none":
          return;
      }
    },
    markAllRead: () => {
      void markAllNotificationsRead(deps);
    },
    markRead: (notificationId) => {
      void markNotificationRead(deps, notificationId);
    },
    retry: () => {
      void query.refetch();
    },
  };
}
