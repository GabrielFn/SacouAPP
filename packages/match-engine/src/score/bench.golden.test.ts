import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "./appliers.js";
import { substitutePlayer } from "./commands.js";
import { parseLineupChangedPayload } from "./parse-payloads.js";
import { getCurrentServingPlayer } from "./rotation-rules.js";
import type { CourtSessionState, MemberId, TeamSide } from "./types.js";

/** Only in TypeScript: the C# port replays the events, and the commands stay on the phone. */
interface RecordedSubstitution {
  readonly sequence: number;
  readonly team: TeamSide;
  readonly outgoing: MemberId;
  readonly incoming: MemberId;
}

interface BenchCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
  readonly servingPlayer?: MemberId;
  readonly substitutions?: readonly RecordedSubstitution[];
}

function readCases(): readonly BenchCase[] {
  const url = new URL("../../golden/bench-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly BenchCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "c1-step-1-point-a",
  "c1-step-2-a-out-g-in-the-new-server",
  "c1-step-3-point-b-side-out",
  "c1-step-4-point-a-side-out",
  "c1-step-5-c-out-a-back-in",
  "c2-step-1-d-out-h-in-skips-the-first-of-the-queue",
  "c2-step-2-a-out-g-in-after-points",
  "c2-step-3-h-out-d-back-after-side-outs",
  "c3-a-change-does-not-move-b",
  "c3-b-change-does-not-move-a",
  "c4-a-whole-set-only-moves-the-zones",
  "c5-six-players-have-an-empty-bench",
  "c6-screen-22-swap-on-the-court-and-new-zone",
  "c6-the-system-does-not-change",
  "c7-rotation-off-rejects-the-change",
  "c7-the-other-team-goes-on",
  "c8-next-set-keeps-bench-and-lineup",
  "c8-last-set-keeps-them-without-a-next-set",
  "c8-finished-match-keeps-the-bench-of-the-end",
  "c9-revert-restores-lineup-and-bench",
  "c9-revert-restores-the-zone",
  "c9-revert-to-the-change-keeps-it",
  "c10-stale-change-after-a-change-and-points-is-applied",
  "c10-points-after-a-stale-change-rotate-from-it",
  "c12-start-without-the-bench-the-e2-4-format",
  "c12-start-bench-null",
  "c12-start-bench-incomplete",
  "c12-start-bench-empty-with-eight-members",
  "c12-start-bench-member-outside-the-team",
  "c12-start-bench-overlaps-the-lineup",
  "c12-start-bench-repeated",
  "c12-start-24-members-have-a-bench-of-18",
  "c12-change-unknown-key",
  "c12-change-without-the-bench",
  "c12-change-bench-null",
  "c12-change-bench-repeated",
  "c12-change-bench-overlaps-the-lineup",
  "c13-change-as-the-first-event",
  "c13-change-with-another-match-id",
  "c13-change-after-the-match-ended",
  "c13-lineup-with-a-member-of-the-other-team",
  "c13-bench-with-an-outsider-of-the-right-size",
  "c13-bench-short-of-the-team",
  "c13-bench-past-the-team",
  "c13-change-with-the-set-closed-and-the-match-open",
  "c13-identical-change-is-applied-without-effect",
  "d4-partition-of-the-teams-is-applied-on-a-drifted-state",
  "d4-partition-of-the-state-only-is-rejected",
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

function replayCase({ courtSessionId, initialState }: BenchCase, events: readonly EventEnvelope[]) {
  const replayed = replayEvents({ courtSessionId, initialState, appliers: SCORE_APPLIERS }, events);
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

function stateBefore(goldenCase: BenchCase, sequence: number): CourtSessionState {
  const earlier = parseEnvelopes(goldenCase.events).filter((event) => event.sequence < sequence);
  const replayed = replayEvents(
    {
      courtSessionId: goldenCase.courtSessionId,
      initialState: goldenCase.initialState,
      appliers: SCORE_APPLIERS,
    },
    earlier,
  );
  if (!replayed.ok) {
    throw new Error(`replay failed: ${replayed.error.code}`);
  }
  return replayed.value.state;
}

describe("bench events golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = replayCase(goldenCase, parseEnvelopes(goldenCase.events));

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port: `bench` comes first, and `[]` is written.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    const ids = CASES.map(({ id }) => id);
    const present = new Set(ids);
    const allowed = new Set(EXPECTED_IDS);
    expect({
      repeated: ids.length - present.size,
      missing: EXPECTED_IDS.filter((id) => !present.has(id)),
      unexpected: ids.filter((id) => !allowed.has(id)),
    }).toStrictEqual({ repeated: 0, missing: [], unexpected: [] });
  });
});

describe("who serves after a change", () => {
  const withServer = CASES.filter(({ servingPlayer }) => servingPlayer !== undefined);

  test.each(withServer)("$id", ({ servingPlayer, ...goldenCase }) => {
    const state = stateBefore({ ...goldenCase }, Number.MAX_SAFE_INTEGER);

    expect(state.currentMatch && getCurrentServingPlayer(state.currentMatch)).toBe(servingPlayer);
  });

  test("the file checks the server in the cases that matter", () => {
    expect(withServer.length).toBeGreaterThan(0);
  });
});

describe("the substitution command records what the golden recorded", () => {
  const recorded = CASES.flatMap((goldenCase) =>
    (goldenCase.substitutions ?? []).map((substitution) => ({
      id: `${goldenCase.id} at ${String(substitution.sequence)}`,
      goldenCase,
      substitution,
    })),
  );

  test.each(recorded)("$id", ({ goldenCase, substitution }) => {
    const { sequence, team, outgoing, incoming } = substitution;
    const event = parseEnvelopes(goldenCase.events).find((item) => item.sequence === sequence);
    const payload = parseLineupChangedPayload(event?.payload);

    const result = substitutePlayer(stateBefore(goldenCase, sequence), team, outgoing, incoming);

    expect(payload.ok).toBe(true);
    expect(result).toStrictEqual({
      ok: true,
      value: [{ type: "LineupChanged", payload: payload.ok ? payload.value : null }],
    });
  });

  test("the file holds the substitutions of the 7 and 8 player tables", () => {
    expect(recorded.length).toBeGreaterThan(0);
  });
});
