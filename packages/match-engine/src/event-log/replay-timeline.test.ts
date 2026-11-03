import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { SCORE_APPLIERS } from "../score/appliers.js";
import type { CourtSessionState } from "../score/types.js";
import {
  FIXTURE_APPENDED,
  FIXTURE_APPLIERS,
  type FixtureState,
} from "./append-fixture.test.fixture.js";
import { REVERTED_TO_EVENT_TYPE } from "./constants.data.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import { replayEvents, replayTimeline } from "./replay-events.js";
import type { EventApplier, EventEnvelope, JsonObject, ReplayConfig } from "./types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "./volume-test-timeout.test.fixture.js";

const COURT = "c0000000-0000-4000-8000-000000000001";
const DEVICE = "d0000000-0000-4000-8000-000000000001";
const CONFIG = {
  courtSessionId: COURT,
  initialState: { values: [] } satisfies FixtureState,
  appliers: FIXTURE_APPLIERS,
};

function eventId(number: number): string {
  return `e0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function event(number: number, payload: JsonObject = { value: number }): EventEnvelope {
  return {
    eventId: eventId(number),
    courtSessionId: COURT,
    deviceId: DEVICE,
    batch: 1,
    sequence: number,
    schemaVersion: 1,
    type: FIXTURE_APPENDED,
    payload,
  };
}

function revert(number: number, target: number): EventEnvelope {
  return { ...event(number, { targetEventId: eventId(target) }), type: REVERTED_TO_EVENT_TYPE };
}

interface ReplayCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: unknown;
  readonly events: readonly unknown[];
}

function readCases(name: string): readonly ReplayCase[] {
  const url = new URL(`../../golden/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly ReplayCase[];
}

/** Envelopes that fail the parser are not for the replay: those cases test the envelope. */
function parseAll(events: readonly unknown[]): readonly EventEnvelope[] | null {
  const parsed: EventEnvelope[] = [];
  for (const raw of events) {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      return null;
    }
    parsed.push(envelope.value);
  }
  return parsed;
}

/** What `replayEvents` returns, rebuilt from the timeline: the last state and the event ids. */
function fromTimeline<S>(config: ReplayConfig<S>, events: readonly EventEnvelope[]) {
  const timeline = replayTimeline(config, events);
  if (!timeline.ok) {
    return timeline;
  }
  const { entries } = timeline.value;
  const last = entries[entries.length - 1];
  return {
    ok: true,
    value: {
      state: last === undefined ? config.initialState : last.state,
      activeEventIds: entries.map((entry) => entry.event.eventId),
    },
  };
}

function expectSameAsReplayEvents<S>(
  { courtSessionId, initialState, events }: ReplayCase,
  appliers: ReadonlyMap<string, EventApplier<S>>,
) {
  const parsed = parseAll(events);
  if (parsed === null) {
    return;
  }
  const config = { courtSessionId, initialState: initialState as S, appliers };
  expect(fromTimeline(config, parsed)).toStrictEqual(replayEvents(config, parsed));
}

describe("replayTimeline", () => {
  test("keeps the state right after each active event, in canonical order", () => {
    const outcome = replayTimeline(CONFIG, [event(2), event(1), event(3)]);

    expect(outcome).toStrictEqual({
      ok: true,
      value: {
        entries: [
          { event: event(1), state: { values: [1] } },
          { event: event(2), state: { values: [1, 2] } },
          { event: event(3), state: { values: [1, 2, 3] } },
        ],
      },
    });
  });

  test("after a RevertedTo, lists only the active events, and never the RevertedTo", () => {
    const outcome = replayTimeline(CONFIG, [event(1), event(2), event(3), revert(4, 1), event(5)]);

    expect(outcome).toStrictEqual({
      ok: true,
      value: {
        entries: [
          { event: event(1), state: { values: [1] } },
          { event: event(5), state: { values: [1, 5] } },
        ],
      },
    });
  });

  test("an empty log has no entries", () => {
    expect(replayTimeline(CONFIG, [])).toStrictEqual({ ok: true, value: { entries: [] } });
  });

  test("fails like replayEvents, without a partial timeline", () => {
    const log = [event(1), revert(2, 9)];

    expect(replayTimeline(CONFIG, log)).toStrictEqual(replayEvents(CONFIG, log));
  });

  test("the last entry holds the state replayEvents returns", () => {
    const log = [event(1), event(2)];
    const outcome = replayTimeline(CONFIG, log);
    const last = outcome.ok ? outcome.value.entries[1] : undefined;

    expect(replayEvents(CONFIG, log)).toStrictEqual({
      ok: true,
      value: { state: last?.state, activeEventIds: [eventId(1), eventId(2)] },
    });
  });
});

describe("replayEvents derives from replayTimeline with the same output", () => {
  test.each(readCases("event-log.json"))("event log: $id", (goldenCase) => {
    expectSameAsReplayEvents<FixtureState>(goldenCase, FIXTURE_APPLIERS);
  });

  test.each([
    ...readCases("score-events.json"),
    ...readCases("rotation-events.json"),
    ...readCases("bench-events.json"),
    ...readCases("libero-events.json"),
    ...readCases("queue-events.json"),
    ...readCases("corrections-events.json"),
  ])(
    "score: $id",
    (goldenCase) => {
      expectSameAsReplayEvents<CourtSessionState>(goldenCase, SCORE_APPLIERS);
    },
    VOLUME_TEST_TIMEOUT_MS,
  );
});
