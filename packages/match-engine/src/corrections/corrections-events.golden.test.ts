import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "../score/appliers.js";
import { getCurrentServingPlayer, getOnCourtBySlot } from "../score/rotation-rules.js";
import type { CourtSessionState, MatchScore, MemberId, TeamSide } from "../score/types.js";

type OnCourt = Readonly<Record<TeamSide, readonly MemberId[] | null>>;

interface CorrectionEventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
  readonly servingPlayer?: MemberId;
  readonly onCourt?: OnCourt;
}

function readCases(): readonly CorrectionEventCase[] {
  const url = new URL("../../golden/corrections-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly CorrectionEventCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "c1-before-the-revert",
  "c1-revert-to-the-third-point-brings-everything-back",
  "c4-side-out-b-serves-in-zone-4",
  "c4-undo-gives-the-serve-back-and-b-returns-to-zone-5",
  "c5-undo-the-set-end-back-to-25-20-decided",
  "c5-the-same-set-end-again-opens-set-2",
  "c7-girar-1-to-6",
  "c7-girar-6-to-5",
  "c7-girar-2-to-1",
  "c7-desgirar-1-to-2",
  "c7-desgirar-6-to-1",
  "c7-desgirar-2-to-3",
  "c8-girar-to-6-then-lose-and-win-the-serve-goes-to-5",
  "c9-switch-at-0-0-of-set-2-changes-both",
  "c9-set-3-starts-with-the-other-of-the-corrected-first-server",
  "c10-switch-at-10-8-changes-only-the-serve",
  "c10-next-point-of-the-new-server-does-not-rotate",
  "c10-undo-of-the-switch-gives-the-serve-back",
  "c11-rotation-off-in-both-teams-is-applied",
  "c11-closed-set-is-rejected",
  "c12-another-set-number-is-rejected",
  "c12-another-match-is-rejected",
  "c12-the-current-values-change-nothing",
  "c12-first-server-is-recorded-as-it-comes",
  "c12-at-0-0-the-recorded-first-server-stays",
  "c12-of-two-writers-the-last-in-the-canonical-order-wins",
  "c13-serving-the-middle-in-position-1-serves",
  "c13-after-the-switch-the-libero-covers-position-1",
  "c14-stale-girar-of-another-writer-keeps-the-recorded-zone",
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

function replayCase({ courtSessionId, initialState, events }: CorrectionEventCase) {
  const replayed = replayEvents(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    parseEnvelopes(events),
  );
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

function currentMatchOf(goldenCase: CorrectionEventCase): MatchScore {
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

describe("corrections events golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = replayCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});

describe("who serves after a correction", () => {
  const withServer = CASES.filter(({ servingPlayer }) => servingPlayer !== undefined);

  test.each(withServer)("$id", (goldenCase) => {
    expect(getCurrentServingPlayer(currentMatchOf(goldenCase))).toBe(goldenCase.servingPlayer);
  });

  test("the file checks the server in the cases that matter", () => {
    expect(withServer.length).toBeGreaterThan(0);
  });
});

describe("who is on the court after a correction", () => {
  const withCourt = CASES.filter(({ onCourt }) => onCourt !== undefined);

  test.each(withCourt)("$id", (goldenCase) => {
    expect(onCourtOf(currentMatchOf(goldenCase))).toStrictEqual(goldenCase.onCourt);
  });

  test("the file checks the court in the cases that matter", () => {
    expect(withCourt.length).toBeGreaterThan(0);
  });
});
