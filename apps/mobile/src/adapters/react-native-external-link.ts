import { Linking } from "react-native";

import type { ExternalLink } from "../services/links/external-link";

/**
 * `openURL` rejects when no app opens the address. `canOpenURL` is not used: on Android 11+ it needs
 * `<queries>` in the manifest for each scheme (ADR 0049, D7).
 */
export const reactNativeExternalLink: ExternalLink = {
  open: async (url) => {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  },
};
