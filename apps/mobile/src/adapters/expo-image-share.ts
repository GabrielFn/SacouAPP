import { err, ok } from "@sacou/volley-rules";
import { isAvailableAsync, shareAsync } from "expo-sharing";

import type { ImageShare } from "../features/profile/ports/card-image";

const PNG_MIME = "image/png";
const PNG_UTI = "public.png";

/** The only place of the card PNG in `expo-sharing`: the system share sheet (WhatsApp, Drive, ...). */
export const expoImageShare: ImageShare = {
  async share(uri) {
    if (!(await isAvailableAsync().catch(() => false))) return err("share-unavailable");
    try {
      await shareAsync(uri, { mimeType: PNG_MIME, UTI: PNG_UTI });
      return ok(null);
    } catch {
      // The reason may carry the path: only the kind goes on.
      return err("share-failed");
    }
  },
};
