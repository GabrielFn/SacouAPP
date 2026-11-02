import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { FIXTURE_APPLIERS, type FixtureState } from "./append-fixture.test.fixture.js";
import { ENVELOPE_FIELDS } from "./constants.data.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import { replayEvents } from "./replay-events.js";
import type { EventEnvelope, ReplayErrorCode } from "./types.js";

interface GoldenExpectedSuccess {
  readonly ok: true;
  readonly state: FixtureState;
  readonly activeEventIds: readonly string[];
}

interface GoldenExpectedFailure {
  readonly ok: false;
  readonly code: string;
  readonly eventId?: string;
  readonly field?: string;
}

interface GoldenCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: FixtureState;
  readonly events: readonly unknown[];
  readonly expected: GoldenExpectedSuccess | GoldenExpectedFailure;
}

const GOLDEN_URL = new URL("../../golden/event-log.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(readFileSync(GOLDEN_URL, "utf8")) as readonly GoldenCase[];

const FORBIDDEN_NAMES = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];
const ALL_REPLAY_CODES: readonly ReplayErrorCode[] = [
  "stream-mismatch",
  "event-id-conflict",
  "sequence-conflict",
  "unsupported-schema-version",
  "unknown-event-type",
  "event-rejected",
  "invalid-revert-target",
];

function runCase({ courtSessionId, initialState, events }: GoldenCase) {
  const parsed: EventEnvelope[] = [];
  for (const raw of events) {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      return { ok: false, ...envelope.error };
    }
    parsed.push(envelope.value);
  }
  const replayed = replayEvents(
    { courtSessionId, initialState, appliers: FIXTURE_APPLIERS },
    parsed,
  );
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

describe("event log golden", () => {
  test.each(GOLDEN_CASES)("$id", (goldenCase) => {
    expect(runCase(goldenCase)).toStrictEqual(goldenCase.expected);
  });

  test("case ids are unique", () => {
    const ids = GOLDEN_CASES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every replay error code has a case", () => {
    const codes = new Set(GOLDEN_CASES.map(({ expected }) => !expected.ok && expected.code));
    expect(ALL_REPLAY_CODES.filter((code) => !codes.has(code))).toStrictEqual([]);
  });

  test("every forbidden name and missing field has a case", () => {
    const ids = new Set(GOLDEN_CASES.map(({ id }) => id));
    FORBIDDEN_NAMES.forEach((name) => {
      expect(ids).toContain(`envelope-forbidden-field-${name}`);
    });
    ENVELOPE_FIELDS.forEach((field) => {
      expect(ids).toContain(`envelope-missing-${field}`);
    });
  });
});
