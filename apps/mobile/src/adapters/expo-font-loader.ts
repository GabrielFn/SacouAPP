import { useFonts } from "expo-font";

import type { FontLoader } from "../services/font-loader";
import { fontFamilies } from "../theme/tokens.data";

const FONT_FILES = {
  [fontFamilies.display600]: require("../../assets/fonts/BarlowCondensed-SemiBold.ttf") as number,
  [fontFamilies.display700]: require("../../assets/fonts/BarlowCondensed-Bold.ttf") as number,
  [fontFamilies.display800]: require("../../assets/fonts/BarlowCondensed-ExtraBold.ttf") as number,
  [fontFamilies.body400]: require("../../assets/fonts/Inter-Regular.ttf") as number,
  [fontFamilies.body500]: require("../../assets/fonts/Inter-Medium.ttf") as number,
  [fontFamilies.body600]: require("../../assets/fonts/Inter-SemiBold.ttf") as number,
  [fontFamilies.body700]: require("../../assets/fonts/Inter-Bold.ttf") as number,
};

export const expoFontLoader: FontLoader = {
  useFontsLoaded() {
    const [loaded, error] = useFonts(FONT_FILES);
    return loaded || error !== null;
  },
};
