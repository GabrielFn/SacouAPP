import type { FontLoader } from "../services/font-loader";

export const fakeFontLoader: FontLoader = {
  useFontsLoaded: () => true,
};
