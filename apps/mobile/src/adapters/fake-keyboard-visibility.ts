import type { KeyboardVisibility } from "../ui/keyboard-visibility";

export interface FakeKeyboardVisibility extends KeyboardVisibility {
  show(): void;
  hide(): void;
  /** How many times the keyboard was asked to close. */
  readonly dismissCount: () => number;
}

export function createFakeKeyboardVisibility(): FakeKeyboardVisibility {
  const state = { visible: false, dismissed: 0 };
  const listeners = new Set<(visible: boolean) => void>();
  const set = (visible: boolean) => {
    state.visible = visible;
    listeners.forEach((listener) => {
      listener(visible);
    });
  };
  return {
    isVisible: () => state.visible,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dismiss() {
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
