import { err, ok } from "@sacou/volley-rules";
import { File, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";

import { cardFileName } from "../features/profile/model/card-file-name";
import type { CardImageCapture } from "../features/profile/ports/card-image";
import { CARD_ASPECT_RATIO } from "../theme/card-tokens.data";

/** Pixels of the exported file (a file size, not a layout measure): sharp on any chat. */
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = Math.round(EXPORT_WIDTH / CARD_ASPECT_RATIO);

/** The gallery keeps the file name: rename the temporary PNG; on any failure keep the original name. */
async function withSacouName(uri: string): Promise<string> {
  try {
    const named = new File(Paths.cache, cardFileName(new Date()));
    await new File(uri).move(named);
    return named.uri;
  } catch {
    return uri;
  }
}

/** The only file that touches `react-native-view-shot` (frontend.md, rule 3). */
export const viewShotCardCapture: CardImageCapture = {
  async capture(target) {
    const node = target.current;
    if (node === null) return err("capture-failed");
    try {
      // `tmpfile` writes into the private cache of the app (outside the backup).
      const uri = await captureRef(node, {
        format: "png",
        result: "tmpfile",
        quality: 1,
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
      });
      return ok(await withSacouName(uri));
    } catch {
      return err("capture-failed");
    }
  },
  discard(uri) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Nothing to do: the cache is cleaned by the system anyway.
    }
    return Promise.resolve();
  },
};
