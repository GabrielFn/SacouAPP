import type { NotificationItem, NotificationList } from "../../../services/api/sacou-api";

export const GROUP_ID = "8a4c2f0e-1111-4c3b-9d2e-0000000000aa";
export const ROUND_ID = "8a4c2f0e-2222-4c3b-9d2e-0000000000bb";
export const NOTIFICATION_ID = "8a4c2f0e-3333-4c3b-9d2e-0000000000cc";

export function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: NOTIFICATION_ID,
    kind: "waitlistPromoted",
    groupId: GROUP_ID,
    roundId: ROUND_ID,
    title: "Você saiu da espera: entrou no Racha de quinta",
    subtitle: "Qui 19h · Ginásio",
    createdAt: "2026-11-19T12:00:00.000Z",
    read: false,
    ...overrides,
  };
}

export function notificationList(items: readonly NotificationItem[]): NotificationList {
  return {
    items: [...items],
    unreadCount: items.filter((item) => !item.read).length,
    nextCursor: null,
  };
}
