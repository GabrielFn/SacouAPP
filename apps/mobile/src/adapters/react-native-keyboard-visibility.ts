import { Keyboard } from "react-native";

import type { KeyboardVisibility } from "../ui/keyboard-visibility";

export function createReactNativeKeyboardVisibility(): KeyboardVisibility {
  return {
    isVisible: () => Keyboard.isVisible(),
    subscribe: (listener) => {
      const shown = Keyboard.addListener("keyboardDidShow", () => {
        listener(true);
      });
      const hidden = Keyboard.addListener("keyboardDidHide", () => {
        listener(false);
      });
      return () => {
        shown.remove();
        hidden.remove();
      };
    },
    dismiss: () => {
      Keyboard.dismiss();
    },
  };
}
