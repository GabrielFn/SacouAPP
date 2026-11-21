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
  const answer = { value: initial };
  const onRequest: { value: PermissionAnswer } = { value: "granted" };
  const requests = { value: 0 };
  const settings = { value: 0 };
  return {
    status: () => Promise.resolve(answer.value),
    request: () => {
      requests.value += 1;
      if (answer.value === "askable") answer.value = onRequest.value;
      return Promise.resolve(answer.value);
    },
    openSettings: () => {
      settings.value += 1;
      return Promise.resolve();
    },
    set(next) {
      answer.value = next;
    },
    answerRequestWith(next) {
      onRequest.value = next;
    },
    requests: () => requests.value,
    settingsOpened: () => settings.value,
  };
}
