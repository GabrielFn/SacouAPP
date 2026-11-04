import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { SCORE_APPLIERS } from "./appliers.js";
import { expectExactIds, expectUniqueIds } from "./golden-ids.test.fixture.js";
import {
  getMatchWinner,
  getSetPointTeams,
  getSetWinner,
  setsToWin,
  targetPointsForSet,
} from "./scoring-rules.js";
import type { CourtSessionState, ScoringRules, SetScore, SetsWon, TeamSide } from "./types.js";

interface RuleCase {
  readonly id: string;
  readonly scoring: ScoringRules;
  readonly setNumber: number;
  readonly score: SetScore;
  readonly setsWon?: SetsWon;
  readonly expected: {
    readonly targetPoints: number;
    readonly setsToWin: number;
    readonly setWinner: TeamSide | null;
    readonly setPointTeams: readonly TeamSide[];
    readonly matchWinner?: TeamSide | null;
  };
}

interface EventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected:
    | {
        readonly ok: true;
        readonly state: CourtSessionState;
        readonly activeEventIds: readonly string[];
      }
    | {
        readonly ok: false;
        readonly code: string;
        readonly eventId?: string;
        readonly field?: string;
      };
}

function readGolden(name: string): unknown {
  const url = new URL(`../../golden/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

const RULE_CASES = readGolden("score-rules.json") as readonly RuleCase[];
const EVENT_CASES = readGolden("score-events.json") as readonly EventCase[];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_RULE_IDS: readonly string[] = [
  "r1-0-0",
  "r1-24-22-set-point-a",
  "r1-25-22-a-wins",
  "r1-25-23-a-wins",
  "r1-22-25-b-wins",
  "r1-22-24-set-point-b",
  "r2-25-24-advantage-not-decided",
  "r2-24-24-no-set-point",
  "r2-26-24-a-wins",
  "r2-29-28-set-point-a",
  "r2-28-30-b-wins",
  "r3-no-advantage-25-24-a-wins",
  "r3-no-advantage-24-25-b-wins",
  "r3-no-advantage-24-24-both-set-point",
  "r3-no-advantage-24-23-set-point-a",
  "r4-single-set-ignores-tie-break",
  "r4-single-set-15-0-does-not-end",
  "r4-md3-set-1-regular",
  "r4-md3-set-2-regular",
  "r4-md3-set-3-tie-break",
  "r4-md5-set-1-regular",
  "r4-md5-set-2-regular",
  "r4-md5-set-3-regular",
  "r4-md5-set-4-regular",
  "r4-md5-set-5-tie-break",
  "r4-md3-tie-break-off",
  "r4-tie-break-above-points",
  "r5-tie-break-15-13-a-wins",
  "r5-tie-break-15-14-set-point-a",
  "r5-tie-break-14-14",
  "r5-tie-break-16-14-a-wins",
  "r5-set-2-15-13-does-not-end",
  "r6-target-1-m1-0-0-both-set-point",
  "r6-target-1-m1-1-0-a-wins",
  "r6-target-1-m2-0-0",
  "r6-target-1-m2-1-0-set-point-a",
  "r6-target-1-m2-1-1",
  "r6-target-1-m2-2-0-a-wins",
  "r7-md1-1-0-a",
  "r7-md1-0-1-b",
  "r7-md1-0-0-none",
  "r7-md3-1-0-none",
  "r7-md3-1-1-none",
  "r7-md3-2-0-a",
  "r7-md3-1-2-b",
  "r7-md5-2-2-none",
  "r7-md5-3-2-a",
  "r7-md5-2-3-b",
];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_EVENT_IDS: readonly string[] = [
  "g1-one-set-25-23-ends-the-match",
  "g2-best-of-3-ends-in-two-sets",
  "g2-point-after-the-end-is-rejected",
  "g3-second-set-keeps-the-regular-target",
  "g3-third-set-opens-with-the-tie-break-target",
  "g3-best-of-3-with-tie-break-a-wins",
  "g4-fourth-set-keeps-the-regular-target",
  "g4-fifth-set-opens-with-the-tie-break-target",
  "g4-best-of-5-a-wins-3-2",
  "g5-advantage-26-24-recorded-as-played",
  "g5-no-advantage-25-24-recorded-as-played",
  "g6-undo-the-first-point-goes-back-to-match-started",
  "g7-point-as-first-event",
  "g7-set-ended-as-first-event",
  "g7-match-ended-as-first-event",
  "g7-reverted-to-as-first-event",
  "g8-only-match-started",
  "g8-empty-log",
  "g9-frozen-copy-with-another-rules-version",
  "g10-revert-over-set-ended-reopens-the-set",
  "g10-play-goes-on-after-reopening-a-set",
  "g10-revert-over-match-ended-reopens-the-match",
  "g10-revert-over-both-reopens-the-last-set",
  "g11-undo-the-last-point-of-a-decided-set",
  "g12-second-match-starts-at-zero",
  "g12-finished-matches-keep-their-order",
  "g12-revert-to-the-end-of-the-first-match",
  "g13-match-started-with-a-match-open",
  "g13-match-id-repeated-while-open",
  "g13-match-id-repeated-after-it-finished",
  "g14-set-ended-at-10-8-is-applied-as-recorded",
  "g14-winner-behind-is-applied-as-recorded",
  "g14-next-target-against-the-rule-is-applied-as-recorded",
  "g14-match-end-against-the-sets-is-applied-as-recorded",
  "g15-point-with-another-match-id",
  "g15-point-with-another-set-number",
  "g15-late-point-of-a-closed-set",
  "g15-set-ended-with-another-match-id",
  "g15-set-ended-with-another-set-number",
  "g15-point-without-an-open-set",
  "g15-set-ended-without-an-open-set",
  "g15-sets-won-with-a-set-open",
  "g15-match-ended-with-another-match-id",
  "g15-next-set-past-the-format-in-one-set",
  "g15-next-set-past-the-format-in-best-of-3",
  "g16-manual-end-with-a-winner-keeps-the-partial",
  "g16-manual-end-without-a-winner-keeps-the-partial",
  "g16-manual-end-right-after-match-started",
  "g17-deciding-set-ended-without-match-ended",
  "g17-point-is-rejected-while-pending",
  "g17-match-ended-completes-the-pending-end",
  "g18-invalid-team-in-the-middle-of-the-log",
  "g18-personal-data-in-the-payload",
  "g18-proto-key-in-the-payload",
  "g18-set-ended-resent-is-ignored",
  "g18-unknown-type-still-fails-closed",
  "g19-200-finished-matches-are-accepted",
  "g19-match-started-after-200-finished-is-rejected",
];

function runEventCase({ courtSessionId, initialState, events }: EventCase) {
  const parsed: EventEnvelope[] = [];
  for (const raw of events) {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      return { ok: false, ...envelope.error };
    }
    parsed.push(envelope.value);
  }
  const replayed = replayEvents({ courtSessionId, initialState, appliers: SCORE_APPLIERS }, parsed);
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

function integerShapedKeys(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return (value as readonly unknown[]).flatMap(integerShapedKeys);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^\d+$/.test(key) ? [key] : []),
    ...integerShapedKeys(child),
  ]);
}

describe("score rules golden", () => {
  test.each(RULE_CASES)("$id", ({ scoring, setNumber, score, setsWon, expected }) => {
    const { bestOf, winMargin } = scoring;
    const targetPoints = targetPointsForSet(scoring, setNumber);

    expect(targetPoints).toBe(expected.targetPoints);
    expect(setsToWin(bestOf)).toBe(expected.setsToWin);
    expect(getSetWinner(score, targetPoints, winMargin)).toBe(expected.setWinner);
    expect(getSetPointTeams(score, targetPoints, winMargin)).toStrictEqual(expected.setPointTeams);
    if (setsWon !== undefined) {
      expect(getMatchWinner(setsWon, bestOf)).toBe(expected.matchWinner);
    }
  });

  test("case ids are unique", () => {
    expectUniqueIds(RULE_CASES);
  });

  test("has exactly the expected cases", () => {
    expectExactIds(RULE_CASES, EXPECTED_RULE_IDS);
  });
});

describe("score events golden", () => {
  test.each(EVENT_CASES)(
    "$id",
    (goldenCase) => {
      const outcome = runEventCase(goldenCase);

      expect(outcome).toStrictEqual(goldenCase.expected);
      // Key order is part of the contract with the C# port.
      expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test("case ids are unique", () => {
    expectUniqueIds(EVENT_CASES);
  });

  test("has exactly the expected cases", () => {
    expectExactIds(EVENT_CASES, EXPECTED_EVENT_IDS);
  });

  test("no expected state has an integer-shaped key, which JavaScript would reorder", () => {
    const offending = EVENT_CASES.flatMap(({ expected }) =>
      expected.ok ? integerShapedKeys(expected.state) : [],
    );
    expect(offending).toStrictEqual([]);
  });

  test("every expected state survives a JSON round trip", () => {
    EVENT_CASES.forEach(({ expected }) => {
      if (expected.ok) {
        expect(JSON.parse(JSON.stringify(expected.state))).toStrictEqual(expected.state);
      }
    });
  });
});
