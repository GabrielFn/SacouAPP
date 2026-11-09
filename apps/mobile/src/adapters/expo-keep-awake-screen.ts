import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import type { ScreenAwake } from "../features/court/ports/screen-awake";

/** A phone that refuses to stay awake is not a reason to stop the match: the errors are dropped. */
export const expoKeepAwakeScreen: ScreenAwake = {
  activate(tag) {
    activateKeepAwakeAsync(tag).catch(() => undefined);
  },
  deactivate(tag) {
    deactivateKeepAwake(tag).catch(() => undefined);
  },
};
