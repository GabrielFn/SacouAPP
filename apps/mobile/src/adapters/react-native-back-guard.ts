import { BackHandler } from "react-native";

import type { BackGuard } from "../features/court/ports/back-guard";

const HARDWARE_BACK = "hardwareBackPress";
const HANDLED = true;

/** Answering "handled" to the back button of Android keeps the app where it is. */
export const reactNativeBackGuard: BackGuard = {
  block() {
    const subscription = BackHandler.addEventListener(HARDWARE_BACK, () => HANDLED);
    return () => {
      subscription.remove();
    };
  },
};
