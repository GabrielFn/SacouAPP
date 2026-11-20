import type { Result } from "@sacou/volley-rules";
import type { RefObject } from "react";
import type { View } from "react-native";

/** The view to turn into a picture: the card, held by a ref of the screen. */
export type CaptureTarget = RefObject<View | null>;

/** The address of the temporary PNG in the private cache of the app. */
export type LocalImageUri = string;

export type CaptureError = "capture-failed";

/** Turns the card on the screen into a PNG and deletes it afterwards (E4.13, part 2). */
export interface CardImageCapture {
  capture(target: CaptureTarget): Promise<Result<LocalImageUri, CaptureError>>;
  /** Deletes the temporary PNG. Never fails. */
  discard(uri: LocalImageUri): Promise<void>;
}

export type ImageShareError = "share-unavailable" | "share-failed";

/** Opens the system share sheet with the PNG; resolves when the sheet closes. */
export interface ImageShare {
  share(uri: LocalImageUri): Promise<Result<null, ImageShareError>>;
}

export type SaveError = "permission-denied" | "save-failed";

/** Writes the PNG to the gallery. Write-only: the app never reads the pictures of the person. */
export interface GallerySaver {
  save(uri: LocalImageUri): Promise<Result<null, SaveError>>;
  /** The shortcut of the "permission denied" message. */
  openSettings(): Promise<void>;
}
