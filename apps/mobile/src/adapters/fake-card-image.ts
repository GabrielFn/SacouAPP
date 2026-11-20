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
  const state = { count: 0, alive: [] as readonly string[], failure: null as CaptureError | null };
  return {
    capture() {
      if (state.failure !== null) {
        const failure = state.failure;
        state.failure = null;
        return Promise.resolve(err(failure));
      }
      state.count += 1;
      const uri = `file:///cache/card-${String(state.count)}.png`;
      state.alive = [...state.alive, uri];
      return Promise.resolve(ok(uri));
    },
    discard(uri) {
      state.alive = state.alive.filter((entry) => entry !== uri);
      return Promise.resolve();
    },
    alive: () => state.alive,
    fail(error) {
      state.failure = error;
    },
  };
}

export interface FakeImageShare extends ImageShare {
  shared(): readonly string[];
  fail(error: ImageShareError): void;
}

/** The share sheet of the tests: records the PNG addresses. */
export function createFakeImageShare(): FakeImageShare {
  const state = { shared: [] as readonly string[], failure: null as ImageShareError | null };
  return {
    share(uri) {
      state.shared = [...state.shared, uri];
      const failure = state.failure;
      state.failure = null;
      return Promise.resolve(failure === null ? ok(null) : err(failure));
    },
    shared: () => state.shared,
    fail(error) {
      state.failure = error;
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
  const state = {
    saved: [] as readonly string[],
    settings: 0,
    failure: null as SaveError | null,
  };
  return {
    save(uri) {
      const failure = state.failure;
      state.failure = null;
      if (failure !== null) return Promise.resolve(err(failure));
      state.saved = [...state.saved, uri];
      return Promise.resolve(ok(null));
    },
    openSettings() {
      state.settings += 1;
      return Promise.resolve();
    },
    saved: () => state.saved,
    settingsOpened: () => state.settings,
    fail(error) {
      state.failure = error;
    },
  };
}
