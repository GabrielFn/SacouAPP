import { err, ok } from "@sacou/volley-rules";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { Linking } from "react-native";

import type { GallerySaver } from "../features/profile/ports/card-image";

const WRITE_ONLY = true;

/** The only place of the gallery in `expo-media-library`: write-only, never reads the pictures. */
export const expoMediaLibrarySaver: GallerySaver = {
  async save(uri) {
    try {
      const permission = await requestPermissionsAsync(WRITE_ONLY);
      if (!permission.granted) return err("permission-denied");
      await Asset.create(uri);
      return ok(null);
    } catch {
      // The reason may carry the path: only the kind goes on.
      return err("save-failed");
    }
  },
  async openSettings() {
    await Linking.openSettings().catch(() => undefined);
  },
};
