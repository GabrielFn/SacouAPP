import type { ScreenOrientation } from "../features/court/ports/screen-orientation";

export interface FakeScreenOrientation extends ScreenOrientation {
  /** Every call in order, as `landscape` or `portrait`. */
  calls(): readonly string[];
}

/** Records the locks; with `rejectLandscape` the lock to landscape fails, like a phone that refuses. */
export function createFakeScreenOrientation(
  options: { readonly rejectLandscape?: boolean } = {},
): FakeScreenOrientation {
  const record = { calls: [] as readonly string[] };
  return {
    lockLandscape() {
      record.calls = [...record.calls, "landscape"];
      return options.rejectLandscape === true
        ? Promise.reject(new Error("landscape refused"))
        : Promise.resolve();
    },
    lockPortrait() {
      record.calls = [...record.calls, "portrait"];
      return Promise.resolve();
    },
    calls: () => record.calls,
  };
}
