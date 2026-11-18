import { AppState } from "react-native";

import type { AppForeground } from "../features/court/ports/app-foreground";

const ACTIVE = "active";

/** `AppState` of React Native: the app came back to the front. */
export const reactNativeAppForeground: AppForeground = {
  subscribe(listener) {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === ACTIVE) listener();
    });
    return () => {
      subscription.remove();
    };
  },
};
