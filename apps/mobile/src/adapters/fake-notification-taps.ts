import type { NotificationTaps } from "../features/notifications/ports/notification-taps";

export interface FakeNotificationTaps extends NotificationTaps {
  /** The touch that opened the app from closed: given once. */
  openedWith(data: unknown): void;
  tap(data: unknown): void;
  receive(): void;
}

export function createFakeNotificationTaps(): FakeNotificationTaps {
  const opened: { value: unknown } = { value: null };
  const taps = { value: [] as readonly ((data: unknown) => void)[] };
  const received = { value: [] as readonly (() => void)[] };
  return {
    lastTap: () => {
      const data = opened.value;
      opened.value = null;
      return Promise.resolve(data);
    },
    onTap(listener) {
      taps.value = [...taps.value, listener];
      return () => {
        taps.value = taps.value.filter((other) => other !== listener);
      };
    },
    onReceived(listener) {
      received.value = [...received.value, listener];
      return () => {
        received.value = received.value.filter((other) => other !== listener);
      };
    },
    openedWith(data) {
      opened.value = data;
    },
    tap(data) {
      taps.value.forEach((listener) => {
        listener(data);
      });
    },
    receive() {
      received.value.forEach((listener) => {
        listener();
      });
    },
  };
}
