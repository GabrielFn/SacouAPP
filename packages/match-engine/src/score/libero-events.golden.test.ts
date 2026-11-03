import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "./appliers.js";
import { getCurrentServingPlayer, getOnCourtBySlot } from "./rotation-rules.js";
import type { CourtSessionState, MatchScore, MemberId, TeamSide } from "./types.js";

type OnCourt = Readonly<Record<TeamSide, readonly MemberId[] | null>>;

interface LiberoEventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
  readonly servingPlayer?: MemberId;
  readonly onCourt?: OnCourt;
}

function readCases(): readonly LiberoEventCase[] {
  const url = new URL("../../golden/libero-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly LiberoEventCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "l1-step-00-start",
  "l1-step-01-point-a-keeps-the-serve",
  "l1-step-02-point-b-side-out",
  "l1-step-03-point-a-zone-6",
  "l1-step-04-point-b",
  "l1-step-05-point-a-zone-5-the-middle-serves",
  "l1-step-06-point-b-a-loses-the-serve-in-zone-5-and-the-libero-comes-in",
  "l1-step-07-point-a-zone-4",
  "l1-step-08-point-b-2",
  "l1-step-09-point-a-zone-3",
  "l1-step-10-point-b-3",
  "l1-step-11-point-a-zone-2-the-other-middle-serves",
  "l1-step-12-point-b-libero-back-in-position-1",
  "l1-step-13-point-a-back-to-zone-1",
  "l2-revert-of-a-point",
  "l3-change-turns-the-libero-off",
  "l3-revert-of-the-change-brings-the-libero-back",
  "l3-revert-to-the-change-keeps-the-libero-off",
  "l3-change-turns-the-libero-on-for-one-middle",
  "l4-set-won-with-the-libero-out",
  "l4-next-set-keeps-the-zone-and-the-libero-comes-in",
  "l5-finished-match-keeps-the-libero-of-the-end",
  "l6-stale-change-of-another-writer-is-applied",
  "l6-points-after-the-stale-change-rotate-from-it",
  "l7-step-1-libero-covers-a3-in-zone-3",
  "l7-step-2-a6-out-a8-in",
  "l7-step-3-side-out-the-libero-goes-out-and-a8-serves",
  "l7-step-4-lost-serve-the-libero-covers-a8",
  "l8-6x2-zone-4-receiving",
  "r-start-in-the-e2-5-format-without-the-libero",
  "r-change-in-the-e2-5-format-without-the-libero",
  "r-start-libero-in-the-4x2",
  "r-start-libero-on-the-setter",
  "r-change-libero-in-the-4x2",
  "r-change-libero-in-the-livre",
  "r-change-libero-on-the-setter-of-the-5x1",
  "r-change-libero-on-the-second-setter-of-the-6x2",
  "r-change-accepts-the-opposite-in-the-5x1",
  "r-change-libero-of-the-other-team",
  "r-change-libero-outside-the-teams",
  "r-change-leaves-the-libero-out",
  "r-change-libero-on-the-team-without-rotation",
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

function replayCase({ courtSessionId, initialState, events }: LiberoEventCase) {
  const replayed = replayEvents(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    parseEnvelopes(events),
  );
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

function currentMatchOf(goldenCase: LiberoEventCase): MatchScore {
  const outcome = replayCase(goldenCase);
  const match = "state" in outcome ? outcome.state.currentMatch : null;
  if (match === null) {
    throw new Error("the case has no open match");
  }
  return match;
}

function onCourtOf(match: MatchScore): OnCourt {
  const servingTeam = match.currentSet?.servingTeam;
  const forTeam = (team: TeamSide) => {
    const teamState = match.rotations[team];
    const phase = servingTeam === team ? "serving" : "receiving";
    return teamState === null ? null : getOnCourtBySlot(teamState, phase);
  };
  return { a: forTeam("a"), b: forTeam("b") };
}

describe("libero events golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = replayCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port: `libero` comes after `bench`.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});

describe("who is on the court", () => {
  const withCourt = CASES.filter(({ onCourt }) => onCourt !== undefined);

  test.each(withCourt)("$id", (goldenCase) => {
    expect(onCourtOf(currentMatchOf(goldenCase))).toStrictEqual(goldenCase.onCourt);
  });

  test("the file checks the court in the cases that matter", () => {
    expect(withCourt.length).toBeGreaterThan(0);
  });
});

describe("who serves", () => {
  const withServer = CASES.filter(({ servingPlayer }) => servingPlayer !== undefined);

  test.each(withServer)("$id", (goldenCase) => {
    expect(getCurrentServingPlayer(currentMatchOf(goldenCase))).toBe(goldenCase.servingPlayer);
  });

  test("the libero never serves", () => {
    const liberos = new Set(
      withServer.flatMap((goldenCase) => {
        const { a, b } = currentMatchOf(goldenCase).rotations;
        return [a?.libero?.memberId, b?.libero?.memberId];
      }),
    );
    expect(withServer.filter(({ servingPlayer }) => liberos.has(servingPlayer))).toStrictEqual([]);
  });
});
