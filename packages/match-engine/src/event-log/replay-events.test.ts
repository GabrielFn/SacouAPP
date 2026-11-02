import { err, ok } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import {
  FIXTURE_APPENDED,
  FIXTURE_APPLIERS,
  FIXTURE_REJECTED,
  type FixtureState,
} from "./append-fixture.test.fixture.js";
import { REVERTED_TO_EVENT_TYPE } from "./constants.data.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import { replayEvents } from "./replay-events.js";
import type { EventApplier, EventEnvelope, JsonObject } from "./types.js";

const COURT = "c0000000-0000-4000-8000-000000000001";
const DEVICE = "d0000000-0000-4000-8000-000000000001";
const INITIAL: FixtureState = { values: [] };
const CONFIG = { courtSessionId: COURT, initialState: INITIAL, appliers: FIXTURE_APPLIERS };
const MANY_EVENTS = 10_000;
const CANARY = "fictional.player@example.com";

function eventId(number: number): string {
  return `e0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function event(
  number: number,
  payload: JsonObject = { value: number },
  overrides: Partial<EventEnvelope> = {},
): EventEnvelope {
  return {
    eventId: eventId(number),
    courtSessionId: COURT,
    deviceId: DEVICE,
    batch: 1,
    sequence: number,
    schemaVersion: 1,
    type: FIXTURE_APPENDED,
    payload,
    ...overrides,
  };
}

function revert(number: number, target: number): EventEnvelope {
  return event(number, { targetEventId: eventId(target) }, { type: REVERTED_TO_EVENT_TYPE });
}

function permutations<T>(items: readonly T[]): readonly (readonly T[])[] {
  if (items.length <= 1) {
    return [items];
  }
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest]),
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("acceptance: the state is recalculated deterministically", () => {
  const log = [event(1), event(2), event(3), revert(4, 2), event(5), event(6)];
  const expected = ok({
    state: { values: [1, 2, 5, 6] },
    activeEventIds: [eventId(1), eventId(2), eventId(5), eventId(6)],
  });

  test("every arrival order of the log gives the same state and active events", () => {
    const orders = permutations(log);
    expect(orders).toHaveLength(720);
    orders.forEach((order) => {
      expect(replayEvents(CONFIG, order)).toStrictEqual(expected);
    });
  });

  test("every arrival order gives the same error", () => {
    const failing = [event(1), event(2, { value: "other" }), event(2), event(3, {}), revert(4, 9)];
    permutations(failing).forEach((order) => {
      expect(replayEvents(CONFIG, order)).toStrictEqual(
        err({ code: "event-id-conflict", eventId: eventId(2) }),
      );
    });
  });

  test("two runs are equal", () => {
    expect(replayEvents(CONFIG, log)).toStrictEqual(replayEvents(CONFIG, log));
  });

  test("an empty log returns the initial state", () => {
    expect(replayEvents(CONFIG, [])).toStrictEqual(ok({ state: INITIAL, activeEventIds: [] }));
  });
});

describe("canonical order", () => {
  test("compares text by UTF-16 code unit, never by locale", () => {
    // Parsed envelopes only hold lowercase UUIDs, whose order is the same under a locale collation.
    // So this case skips the parser: it is the one way to tell the two comparisons apart.
    const upper = event(1, { value: "upper" }, { sequence: 1, deviceId: "B" });
    const lower = event(2, { value: "lower" }, { sequence: 1, deviceId: "a" });

    const replayed = replayEvents(CONFIG, [lower, upper]);

    expect(replayed.ok && replayed.value.state.values).toStrictEqual(["upper", "lower"]);
  });
});

describe("structural comparison of duplicates", () => {
  test("a __proto__ key is not mistaken for a missing one", () => {
    const withProto: unknown = JSON.parse('{ "__proto__": {} }');
    const first = event(1, withProto as JsonObject);
    const second = event(1, { other: {} });

    expect(replayEvents(CONFIG, [first, second])).toStrictEqual(
      err({ code: "event-id-conflict", eventId: eventId(1) }),
    );
  });
});

describe("resend with keys in another order", () => {
  test("every arrival order gives the same state text", () => {
    const parse = (value: string): EventEnvelope => {
      const payload: unknown = JSON.parse(value);
      const parsed = parseEventEnvelope({ ...event(1), payload });
      if (!parsed.ok) {
        throw new Error("expected a valid envelope");
      }
      return parsed.value;
    };
    const first = parse('{ "value": { "a": 1, "b": 2 } }');
    const second = parse('{ "value": { "b": 2, "a": 1 } }');

    [
      [first, second],
      [second, first],
    ].forEach((order) => {
      expect(JSON.stringify(replayEvents(CONFIG, order))).toContain('[{"a":1,"b":2}]');
    });
  });
});

describe("failing closed", () => {
  test("an applier that throws becomes event-rejected, without the message", () => {
    const appliers = new Map<string, EventApplier<FixtureState>>([
      [
        FIXTURE_APPENDED,
        () => {
          throw new Error(CANARY);
        },
      ],
    ]);

    const replayed = replayEvents({ ...CONFIG, appliers }, [event(1)]);

    expect(replayed).toStrictEqual(err({ code: "event-rejected", eventId: eventId(1) }));
    expect(JSON.stringify(replayed)).not.toContain(CANARY);
  });

  test("an applier that mutates a frozen state is caught", () => {
    const appliers = new Map<string, EventApplier<FixtureState>>([
      [
        FIXTURE_APPENDED,
        (state) => {
          (state.values as number[]).push(1);
          return ok(state);
        },
      ],
    ]);
    const frozen = { ...CONFIG, appliers, initialState: deepFreeze({ values: [] }) };

    expect(replayEvents(frozen, [event(1)])).toStrictEqual(
      err({ code: "event-rejected", eventId: eventId(1) }),
    );
  });

  test("an applier registered for RevertedTo cannot take over the core", () => {
    const appliers = new Map(FIXTURE_APPLIERS).set(REVERTED_TO_EVENT_TYPE, () =>
      ok({ values: ["hijacked"] }),
    );

    const replayed = replayEvents({ ...CONFIG, appliers }, [event(1), event(2), revert(3, 1)]);

    expect(replayed.ok && replayed.value.state.values).toStrictEqual([1]);
  });

  test.each([
    ["deviceId", { deviceId: CANARY }],
    ["type", { type: CANARY.repeat(5) }],
    ["unknown key", { [CANARY]: 1 }],
    ["unknown value", { memberName: CANARY }],
    ["payload", { payload: CANARY }],
  ])("a parser error never carries the received %s", (_label, overrides) => {
    const parsed = parseEventEnvelope({ ...event(1), ...overrides });

    expect(parsed.ok).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain(CANARY);
  });

  test.each([
    ["stream-mismatch", [event(1, { value: CANARY }, { courtSessionId: "other" })]],
    ["event-id-conflict", [event(1, { value: CANARY }), event(1)]],
    ["sequence-conflict", [event(1, { value: CANARY }), event(2, {}, { sequence: 1 })]],
    ["unsupported-schema-version", [event(1, { value: CANARY }, { schemaVersion: 2 })]],
    ["unknown-event-type", [event(1, {}, { type: CANARY })]],
    ["event-rejected", [event(1, { value: CANARY }, { type: FIXTURE_REJECTED })]],
    ["invalid-revert-target", [event(1, { targetEventId: CANARY }, { type: "RevertedTo" })]],
  ])("a %s error never carries received content", (code, events) => {
    const replayed = replayEvents(CONFIG, events);

    expect(!replayed.ok && replayed.error.code).toBe(code);
    expect(JSON.stringify(replayed)).not.toContain(CANARY);
  });
});

describe("purity", () => {
  test("frozen input and states stay intact", () => {
    const log = deepFreeze([event(3), event(1), revert(4, 1), event(2)]);
    const snapshot = JSON.stringify(log);
    const initialState = deepFreeze<FixtureState>({ values: ["seed"] });
    const freezingAppliers = new Map<string, EventApplier<FixtureState>>([
      [
        FIXTURE_APPENDED,
        (state, envelope) => ok(deepFreeze({ values: [...state.values, envelope.sequence] })),
      ],
    ]);

    const replayed = replayEvents({ ...CONFIG, initialState, appliers: freezingAppliers }, log);

    expect(replayed.ok && replayed.value.state.values).toStrictEqual(["seed", 1]);
    expect(JSON.stringify(log)).toBe(snapshot);
    expect(initialState).toStrictEqual({ values: ["seed"] });
  });

  test("the result survives a JSON round trip", () => {
    const replayed = replayEvents(CONFIG, [event(1), event(2, { value: { deep: [1, null] } })]);

    expect(JSON.parse(JSON.stringify(replayed))).toStrictEqual(replayed);
  });
});

describe("volume", () => {
  test(`${String(MANY_EVENTS)} events do not overflow the stack`, () => {
    const log = Array.from({ length: MANY_EVENTS }, (_, index) => event(index + 1, { value: 0 }));

    const replayed = replayEvents(CONFIG, log);

    expect(replayed.ok && replayed.value.activeEventIds).toHaveLength(MANY_EVENTS);
  });

  test(`a revert over ${String(MANY_EVENTS)} events does not overflow the stack`, () => {
    const log = Array.from({ length: MANY_EVENTS }, (_, index) => event(index + 1, { value: 0 }));

    const replayed = replayEvents(CONFIG, [...log, revert(MANY_EVENTS + 1, 1)]);

    expect(replayed.ok && replayed.value.activeEventIds).toStrictEqual([eventId(1)]);
  });

  test("alternating events and reverts complete", () => {
    const log = Array.from({ length: MANY_EVENTS }, (_, index) =>
      index % 2 === 0 ? event(index + 1, { value: 0 }) : revert(index + 1, index),
    );

    expect(replayEvents(CONFIG, log).ok).toBe(true);
  });
});
