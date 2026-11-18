import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "../score/appliers.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import { replayTimeline } from "./replay-events.js";
import {
  type GoldenCommand,
  playCommands,
  SERVER_CHECKS_COURT_SESSION_ID,
} from "./server-checks.test.fixture.js";
import type { EventEnvelope } from "./types.js";

interface AcceptedExpectation {
  readonly ok: true;
}

interface RefusedExpectation {
  readonly ok: false;
  readonly code: string;
  readonly eventId: string;
  readonly reason?: string;
}

interface ServerCheckCase {
  readonly id: string;
  readonly events: readonly unknown[];
  readonly groupMemberIds: readonly string[];
  readonly commands?: readonly GoldenCommand[];
  /** The index of the first event of batch 2, written by the phone that took the court over. */
  readonly takeoverAt?: number;
  readonly expected: AcceptedExpectation | RefusedExpectation;
}

function readCases(): readonly ServerCheckCase[] {
  const url = new URL("../../golden/server-checks.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly ServerCheckCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "s1-a-full-match-with-a-toss-for-the-deciding-set",
  "s2-serve-corrections-attribution-queue-and-manual-end",
  "s3-rotations-an-ace-of-the-server-and-a-block-after-a-side-out",
  "s4-an-undo-and-the-point-again",
  "r1-set-ended-at-0-0",
  "r2-point-in-a-decided-set",
  "r3-wrong-target-points-of-the-tie-break",
  "r4-setter-zones-swapped",
  "r5-first-server-not-alternated",
  "r6-serving-team-changed-to-the-same-team",
  "r7-lineup-changed-while-the-match-is-pending",
  "r8-orphan-point-attributed",
  "r9-ace-of-the-receiving-team",
  "r10-queue-changed-to-the-same-queue",
  "r11-unsupported-rules-version",
  "r12-member-outside-the-group",
  "r13-two-set-ended-at-0-0-and-a-match-won",
  "r14-match-won-by-the-wrong-team",
  "r15-unsupported-formations-version",
  "t8a-undo-right-after-the-takeover",
  "t8b-revert-to-the-last-event-of-the-first-batch",
  "t8c-revert-to-the-middle-of-the-first-batch",
];

function parseEnvelopes(events: readonly unknown[]): readonly EventEnvelope[] {
  return events.map((raw) => {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      throw new Error(`invalid envelope: ${envelope.error.field}`);
    }
    return envelope.value;
  });
}

const accepted = CASES.filter(({ expected }) => expected.ok);
const refused = CASES.filter(({ expected }) => !expected.ok);

describe("server checks golden", () => {
  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });

  test("has accepted and refused cases", () => {
    expect(accepted.length).toBeGreaterThan(0);
    expect(refused.length).toBeGreaterThan(0);
  });

  // The gap the server closes: the engine's replay accepts every forged log.
  test.each(refused)("$id passes the replay of the engine", ({ events }) => {
    const timeline = replayTimeline(
      {
        courtSessionId: SERVER_CHECKS_COURT_SESSION_ID,
        initialState: INITIAL_COURT_SESSION_STATE,
        appliers: SCORE_APPLIERS,
      },
      parseEnvelopes(events),
    );

    expect(timeline.ok).toBe(true);
  });

  test.each(refused)("$id names an event of the log", ({ events, expected }) => {
    const ids = parseEnvelopes(events).map(({ eventId }) => eventId);

    expect(ids).toContain(expected.ok ? null : expected.eventId);
  });

  // An accepted log is what an honest phone records: the commands emit exactly it.
  test.each(accepted)("$id comes from the commands", ({ commands, events, takeoverAt }) => {
    expect(playCommands(commands ?? [], takeoverAt)).toStrictEqual(parseEnvelopes(events));
  });

  // Answer 74 (ADR 0063, D9): whoever writes after a takeover undoes points of the earlier batch.
  const takeovers = CASES.filter(({ takeoverAt }) => takeoverAt !== undefined);

  test("has the takeover cases of answer 74", () => {
    expect(takeovers.map(({ id }) => id)).toStrictEqual(
      EXPECTED_IDS.filter((id) => id.startsWith("t8")),
    );
  });

  test.each(takeovers)(
    "$id reverts to an event of batch 1 from batch 2",
    ({ events, takeoverAt }) => {
      const parsed = parseEnvelopes(events);
      const firstBatchIds = new Set(parsed.slice(0, takeoverAt).map(({ eventId }) => eventId));
      const reverts = parsed.slice(takeoverAt).filter(({ type }) => type === "RevertedTo");

      expect(reverts.length).toBeGreaterThan(0);
      expect(reverts.every(({ batch }) => batch === 2)).toBe(true);
      expect(
        reverts.some(({ payload }) => firstBatchIds.has(String(payload["targetEventId"]))),
      ).toBe(true);
    },
  );
});
