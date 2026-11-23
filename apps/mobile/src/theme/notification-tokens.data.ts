// Measures of the notifications (Notificacoes.dc.html) and of the dot of the bell, in canvas pixels,
// scaled by the window like the other tokens; the touch targets keep the floor of 44.
export const notificationSizes = {
  /** A line of the list (.it): the whole line is the target. */
  rowMin: 48,
  /** The circle of the kind of a line (.ic). */
  icon: 40,
  /** The dot of an unread one (.dot), on a line and on the bell. */
  unreadDot: 8,
  /** The yellow circle of the bell of the permission card. */
  permissionIcon: 44,
  /** "Marcar como lidas" of the header (48 high in the canvas). */
  headerButton: 48,
} as const;

/** The targets of screen 28, kept over the touch floor at any width. */
export const notificationTargets = [
  notificationSizes.rowMin,
  notificationSizes.headerButton,
] as const;

/** How far "Notificações" may shrink to stay on one line beside "Marcar como lidas" (R98, item 8). */
export const NOTIFICATIONS_TITLE_MIN_FONT_SCALE = 0.7;

/** From this font scale the header wraps and "Marcar como lidas" goes under the title (R98, item 8). */
export const NOTIFICATIONS_HEADER_WRAP_FONT_SCALE = 1.3;
