import { err, ok } from "@sacou/volley-rules";

import type {
  CaptureError,
  CardImageCapture,
  GallerySaver,
  ImageShare,
  ImageShareError,
  SaveError,
} from "../features/profile/ports/card-image";

export interface FakeCardImageCapture extends CardImageCapture {
  /** Temporary PNGs created and not deleted yet. */
  alive(): readonly string[];
  /** The next capture fails (once). */
  fail(error: CaptureError): void;
}

/** The capture of the tests: a PNG address in memory, deleted by `discard`. */
export function createFakeCardImageCapture(): FakeCardImageCapture {
  const cell = {
    value: { count: 0, alive: [] as readonly string[], failure: null as CaptureError | null },
  };
  return {
    capture() {
      const { failure, count, alive } = cell.value;
      if (failure !== null) {
        cell.value = { count, alive, failure: null };
        return Promise.resolve(err(failure));
      }
      const uri = `file:///cache/card-${String(count + 1)}.png`;
      cell.value = { count: count + 1, alive: [...alive, uri], failure: null };
      return Promise.resolve(ok(uri));
    },
    discard(uri) {
      cell.value = { ...cell.value, alive: cell.value.alive.filter((entry) => entry !== uri) };
      return Promise.resolve();
    },
    alive: () => cell.value.alive,
    fail(error) {
      cell.value = { ...cell.value, failure: error };
    },
  };
}

export interface FakeImageShare extends ImageShare {
  shared(): readonly string[];
  fail(error: ImageShareError): void;
}

/** The share sheet of the tests: records the PNG addresses. */
export function createFakeImageShare(): FakeImageShare {
  const cell = {
    value: { shared: [] as readonly string[], failure: null as ImageShareError | null },
  };
  return {
    share(uri) {
      const { failure, shared } = cell.value;
      cell.value = { shared: [...shared, uri], failure: null };
      return Promise.resolve(failure === null ? ok(null) : err(failure));
    },
    shared: () => cell.value.shared,
    fail(error) {
      cell.value = { ...cell.value, failure: error };
    },
  };
}

export interface FakeGallerySaver extends GallerySaver {
  saved(): readonly string[];
  settingsOpened(): number;
  fail(error: SaveError): void;
}

/** The gallery of the tests: records the PNG addresses. */
export function createFakeGallerySaver(): FakeGallerySaver {
  const cell = {
    value: { saved: [] as readonly string[], settings: 0, failure: null as SaveError | null },
  };
  return {
    save(uri) {
      const { failure, saved, settings } = cell.value;
      if (failure !== null) {
        cell.value = { saved, settings, failure: null };
        return Promise.resolve(err(failure));
      }
      cell.value = { saved: [...saved, uri], settings, failure: null };
      return Promise.resolve(ok(null));
    },
    openSettings() {
      cell.value = { ...cell.value, settings: cell.value.settings + 1 };
      return Promise.resolve();
    },
    saved: () => cell.value.saved,
    settingsOpened: () => cell.value.settings,
    fail(error) {
      cell.value = { ...cell.value, failure: error };
    },
  };
}
