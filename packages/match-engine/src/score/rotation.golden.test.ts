import { readFileSync } from "node:fs";

import type { SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { SCORE_APPLIERS } from "./appliers.js";
import {
  getLineupBySlot,
  getNextSetFirstServer,
  getServingPlayer,
  isSideOut,
  nextSetterZone,
  previousSetterZone,
} from "./rotation-rules.js";
import type { CourtSessionState, MemberId, TeamSide } from "./types.js";

interface ZoneCase {
  readonly id: string;
  readonly rule: "zone";
  readonly input: { readonly lineup: readonly MemberId[]; readonly setterZone: SetterZone };
  readonly expected: {
    readonly nextSetterZone: SetterZone;
    readonly lineupBySlot: readonly MemberId[];
    readonly servingPlayer: MemberId;
  };
}

interface SideOutCase {
  readonly id: string;
  readonly rule: "side-out";
  readonly input: { readonly servingTeam: TeamSide; readonly pointWinner: TeamSide };
  readonly expected: { readonly isSideOut: boolean };
}

interface NextFirstServerCase {
  readonly id: string;
  readonly rule: "next-first-server";
  readonly input: { readonly firstServer: TeamSide };
  readonly expected: { readonly firstServer: TeamSide };
}

interface PreviousZoneCase {
  readonly id: string;
  readonly rule: "previous-zone";
  readonly input: { readonly setterZone: SetterZone };
  readonly expected: { readonly previousSetterZone: SetterZone };
}

type RuleCase = ZoneCase | SideOutCase | NextFirstServerCase | PreviousZoneCase;

interface EventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
}

function readGolden(name: string): unknown {
  const url = new URL(`../../golden/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

const RULE_CASES = readGolden("rotation-rules.json") as readonly RuleCase[];
const EVENT_CASES = readGolden("rotation-events.json") as readonly EventCase[];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_RULE_IDS: readonly string[] = [
  "zone-1-next-6",
  "zone-6-next-5",
  "zone-5-next-4",
  "zone-4-next-3",
  "zone-3-next-2",
  "zone-2-next-1",
  "side-out-a-serving-b-wins",
  "side-out-b-serving-a-wins",
  "no-side-out-a-serving-a-wins",
  "no-side-out-b-serving-b-wins",
  "next-first-server-after-a",
  "next-first-server-after-b",
  "zone-1-previous-2",
  "zone-2-previous-3",
  "zone-3-previous-4",
  "zone-4-previous-5",
  "zone-5-previous-6",
  "zone-6-previous-1",
];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_EVENT_IDS: readonly string[] = [
  "s1-first-server-wins-does-not-rotate",
  "s1-b-first-server-wins-streak",
  "s1-streak-after-a-side-out-rotates-once",
  "s2-receiver-wins-the-first-rally",
  "s2-b-receiver-wins-the-first-rally",
  "s3-step-01",
  "s3-step-02",
  "s3-step-03",
  "s3-step-04",
  "s3-step-05",
  "s3-step-06",
  "s3-step-07",
  "s3-step-08",
  "s3-step-09",
  "s3-step-10",
  "s3-step-11",
  "s3-step-12",
  "s4-each-team-has-its-own-rotation",
  "s6-side-out-on-the-deciding-point",
  "s6-serving-team-wins-the-set-without-rotating",
  "s7-tie-break-at-8-server-does-not-rotate",
  "s7-tie-break-at-8-only-the-side-out-rotates",
  "s8-first-rally-next-set-server-wins",
  "s8-first-rally-next-set-receiver-wins",
  "s8-first-server-against-alternation-is-applied-as-recorded",
  "s8-zones-against-the-last-set-are-applied-as-recorded",
  "s8-toss-of-the-deciding-set-of-best-of-3",
  "s8-toss-of-the-deciding-set-of-best-of-5",
  "s8-deciding-set-ended-keeps-the-last-zones",
  "s8-null-zone-for-a-team-with-rotation",
  "s8-zone-for-a-team-without-rotation",
  "s9-undo-a-side-out",
  "s9-undo-a-point-after-a-side-out",
  "s9-play-after-undoing-a-side-out",
  "s9-revert-over-set-ended",
  "s10-rotation-off-still-tracks-the-serve",
  "s10-only-one-team-with-rotation",
  "s11-interleaved-writers-are-not-rejected",
  "s11-arrival-order-does-not-change-it",
  "s12-another-rules-version-has-the-same-transition",
  "s13-screen-25-set-1-25-22",
  "s13-screen-25-azul-serves-the-next-set",
  "s13-before-screen-24-12-11",
  "s13-screen-09-18-15",
  "s13-screen-24-back-to-16-14",
  "s13-screen-10-24-21",
  "s14-manual-end-keeps-the-serve-and-the-rotation",
  "s14-a-new-match-starts-from-its-own-setup",
  "s15-match-started-in-the-e2-2-format-is-rejected",
  "s15-set-ended-in-the-e2-2-format-is-rejected",
  "s15-point-with-a-recorded-rotation-is-rejected",
  "s15-lineup-with-a-member-outside-the-team",
  "s15-match-started-in-the-e2-3-format-is-rejected",
  "s15-match-started-without-the-system-is-rejected",
  "s15-match-started-without-formations-version-is-rejected",
  "s15-system-outside-the-catalog-is-rejected",
  "s15-formations-version-0-is-rejected",
  "s16-each-team-keeps-its-own-system",
  "s16-system-survives-the-next-set",
  "s16-system-survives-the-undo",
  "s16-system-survives-the-end-of-the-match",
  "s16-unknown-formations-version-is-applied-as-recorded",
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

function outcomeOfRule(goldenCase: RuleCase): unknown {
  switch (goldenCase.rule) {
    case "zone": {
      const { lineup, setterZone } = goldenCase.input;
      return {
        nextSetterZone: nextSetterZone(setterZone),
        lineupBySlot: getLineupBySlot(lineup, setterZone),
        servingPlayer: getServingPlayer(lineup, setterZone),
      };
    }
    case "side-out": {
      const { servingTeam, pointWinner } = goldenCase.input;
      return { isSideOut: isSideOut(servingTeam, pointWinner) };
    }
    case "next-first-server":
      return { firstServer: getNextSetFirstServer(goldenCase.input.firstServer) };
    case "previous-zone":
      return { previousSetterZone: previousSetterZone(goldenCase.input.setterZone) };
  }
}

function expectExactIds(cases: readonly { readonly id: string }[], expected: readonly string[]) {
  const ids = cases.map(({ id }) => id);
  const present = new Set(ids);
  const allowed = new Set(expected);
  expect({
    repeated: ids.length - present.size,
    missing: expected.filter((id) => !present.has(id)),
    unexpected: ids.filter((id) => !allowed.has(id)),
  }).toStrictEqual({ repeated: 0, missing: [], unexpected: [] });
}

describe("rotation rules golden", () => {
  test.each(RULE_CASES)("$id", (goldenCase) => {
    const outcome = outcomeOfRule(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expectExactIds(RULE_CASES, EXPECTED_RULE_IDS);
  });
});

describe("rotation events golden", () => {
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

  test("has exactly the expected cases", () => {
    expectExactIds(EVENT_CASES, EXPECTED_EVENT_IDS);
  });
});
