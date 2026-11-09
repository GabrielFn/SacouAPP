import {
  impactAsync,
  ImpactFeedbackStyle,
  notificationAsync,
  NotificationFeedbackType,
} from "expo-haptics";

import type { CourtFeedback } from "../features/court/ports/court-feedback";
import type { FeedbackKind } from "../features/court/model/feedback";

/** Which buzz each event of the court makes (docs/dominio/quadra.md). */
const BUZZ: Readonly<Record<FeedbackKind, () => Promise<void>>> = {
  point: () => impactAsync(ImpactFeedbackStyle.Light),
  "side-out": () => impactAsync(ImpactFeedbackStyle.Medium),
  "set-point": () => notificationAsync(NotificationFeedbackType.Warning),
  "set-ended": () => notificationAsync(NotificationFeedbackType.Success),
  "match-ended": () => notificationAsync(NotificationFeedbackType.Success),
  refused: () => notificationAsync(NotificationFeedbackType.Error),
};

/** A phone without a motor is not a reason to stop the match: the errors are dropped. */
export const expoHapticsFeedback: CourtFeedback = {
  play(kind) {
    BUZZ[kind]().catch(() => undefined);
  },
};
