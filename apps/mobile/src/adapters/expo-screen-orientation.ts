import * as ExpoScreenOrientation from "expo-screen-orientation";

import type { ScreenOrientation } from "../features/court/ports/screen-orientation";

/**
 * Landscape in both senses (the phone can lean on the charger at either side); back to upright
 * with `PORTRAIT_UP`. Never `unlockAsync`: it would let the whole app turn with the phone.
 */
export const expoScreenOrientation: ScreenOrientation = {
  lockLandscape: () =>
    ExpoScreenOrientation.lockAsync(ExpoScreenOrientation.OrientationLock.LANDSCAPE),
  lockPortrait: () =>
    ExpoScreenOrientation.lockAsync(ExpoScreenOrientation.OrientationLock.PORTRAIT_UP),
};
