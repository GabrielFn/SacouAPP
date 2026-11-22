import type { KeyboardVisibility } from "../ui/keyboard-visibility";

type Listener = (visible: boolean) => void;

export interface FakeKeyboardVisibility extends KeyboardVisibility {
  readonly show: () => void;
  readonly hide: () => void;
  /** How many times the keyboard was asked to close. */
  readonly dismissCount: () => number;
}

export function createFakeKeyboardVisibility(): FakeKeyboardVisibility {
  const visible = { value: false };
  const dismissed = { value: 0 };
  const listeners: { value: readonly Listener[] } = { value: [] };
  const set = (next: boolean) => {
    visible.value = next;
    listeners.value.forEach((listener) => {
      listener(next);
    });
  };
  return {
    isVisible: () => visible.value,
    subscribe: (listener) => {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((item) => item !== listener);
      };
    },
    dismiss: () => {
      dismissed.value += 1;
      set(false);
    },
    show: () => {
      set(true);
    },
    hide: () => {
      set(false);
    },
    dismissCount: () => dismissed.value,
  };
}
