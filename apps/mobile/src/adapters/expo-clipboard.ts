import * as ExpoClipboard from "expo-clipboard";

import type { Clipboard } from "../services/clipboard/clipboard";

export const expoClipboard: Clipboard = {
  setText: async (text) => {
    await ExpoClipboard.setStringAsync(text);
  },
};
