import type {
  NotificationPermission,
  PermissionAnswer,
} from "../features/notifications/ports/notification-permission";

export interface FakeNotificationPermission extends NotificationPermission {
  /** What the phone says from now on, and what the system question answers. */
  set(answer: PermissionAnswer): void;
  answerRequestWith(answer: PermissionAnswer): void;
  requests(): number;
  settingsOpened(): number;
}

/** The permission of the tests: no system question, every call counted. */
export function createFakeNotificationPermission(
  initial: PermissionAnswer = "askable",
): FakeNotificationPermission {
  const state = { answer: initial, onRequest: "granted" as PermissionAnswer };
  const counts = { requests: 0, settings: 0 };
  return {
    status: () => Promise.resolve(state.answer),
    request: () => {
      counts.requests += 1;
      if (state.answer === "askable") state.answer = state.onRequest;
      return Promise.resolve(state.answer);
    },
    openSettings: () => {
      counts.settings += 1;
      return Promise.resolve();
    },
    set(answer) {
      state.answer = answer;
    },
    answerRequestWith(answer) {
      state.onRequest = answer;
    },
    requests: () => counts.requests,
    settingsOpened: () => counts.settings,
  };
}
