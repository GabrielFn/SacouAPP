import { Share } from "react-native";

import type { ShareSheet } from "../services/share/share-sheet";

/** The share sheet of the phone; a failure to open it is not an error for the screen. */
export const reactNativeShareSheet: ShareSheet = {
  share: async (text) => {
    try {
      await Share.share({ message: text });
    } catch {
      // The person can still copy the round by hand; nothing to report.
    }
  },
};
