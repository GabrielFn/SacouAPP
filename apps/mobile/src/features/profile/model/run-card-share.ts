import type {
  CardImageCapture,
  CaptureTarget,
  GallerySaver,
  ImageShare,
} from "../ports/card-image";
import type { CardShareAction, CardShareIntent } from "./card-share.reducer";

export interface CardSharePorts {
  readonly capture: CardImageCapture;
  readonly imageShare: ImageShare;
  readonly gallery: GallerySaver;
}

/**
 * Captures the card, hands the PNG to the share sheet or the gallery and deletes it afterwards, also on
 * failure. Effects live here, not in the reducer (frontend.md, rule 4); it only dispatches.
 */
export async function runCardShare(
  intent: CardShareIntent,
  target: CaptureTarget,
  ports: CardSharePorts,
  dispatch: (action: CardShareAction) => void,
): Promise<void> {
  const captured = await ports.capture.capture(target).catch(() => null);
  if (captured === null || !captured.ok) {
    dispatch({ type: "failed", reason: "capture-failed" });
    return;
  }
  const uri = captured.value;
  try {
    dispatch({ type: "captured" });
    if (intent === "share") {
      const shared = await ports.imageShare.share(uri).catch(() => null);
      if (shared === null) dispatch({ type: "failed", reason: "share-failed" });
      else if (shared.ok) dispatch({ type: "shared" });
      else dispatch({ type: "failed", reason: shared.error });
    } else {
      const saved = await ports.gallery.save(uri).catch(() => null);
      if (saved === null) dispatch({ type: "failed", reason: "save-failed" });
      else if (saved.ok) dispatch({ type: "saved" });
      else dispatch({ type: "failed", reason: saved.error });
    }
  } finally {
    await ports.capture.discard(uri).catch(() => null);
  }
}
