import { err, ok } from "@sacou/volley-rules";

import type { EventApplier, JsonValue } from "./types.js";

/** Test-only, and ported by E2.10. Appending is not commutative, so it reveals order mistakes. */
export interface FixtureState {
  readonly values: readonly JsonValue[];
}

export const FIXTURE_APPENDED = "FixtureAppended";
export const FIXTURE_REJECTED = "FixtureRejected";

const appendValue: EventApplier<FixtureState> = (state, event) => {
  const { value } = event.payload;
  return value === undefined
    ? err({ code: "event-rejected" })
    : ok({ values: [...state.values, value] });
};

export const FIXTURE_APPLIERS: ReadonlyMap<string, EventApplier<FixtureState>> = new Map([
  [FIXTURE_APPENDED, appendValue],
  [FIXTURE_REJECTED, () => err({ code: "event-rejected" })],
]);
