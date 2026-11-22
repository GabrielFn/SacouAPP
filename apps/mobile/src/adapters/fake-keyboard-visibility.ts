import type { KeyboardVisibility } from "../ui/keyboard-visibility";

type Listener = (visible: boolean) => void;

export interface FakeKeyboardVisibility extends KeyboardVisibility {
  readonly show: () => void;
  readonly hide: () => void;
  /** How many times the keyboard was asked to close. */
  readonly dismissCount: () => number;
}

export function createFakeKeyboardVisibility(): FakeKeyboardVisibility {
  const state: { visible: boolean; dismissed: number; listeners: readonly Listener[] } = {
    visible: false,
    dismissed: 0,
    listeners: [],
  };
  const set = (visible: boolean) => {
    state.visible = visible;
    state.listeners.forEach((listener) => {
      listener(visible);
    });
  };
  return {
    isVisible: () => state.visible,
    subscribe: (listener) => {
      state.listeners = [...state.listeners, listener];
      return () => {
        state.listeners = state.listeners.filter((item) => item !== listener);
      };
    },
    dismiss: () => {
      state.dismissed += 1;
      set(false);
    },
    show: () => {
      set(true);
    },
    hide: () => {
      set(false);
    },
    dismissCount: () => state.dismissed,
  };
}
