import {
  getServingPlayer,
  INITIAL_COURT_SESSION_STATE,
  parseMatchStartedPayload,
  startMatch,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { signedInCourtSyncHooks } from "../../../adapters/fake-court-sync";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { withLeaf } from "../../groups/model/settings-patch";
import { createCourtReplayer } from "../../court/session/court-replay";
import { sessionState } from "../../court/session/round-court";
import { startFromDraw } from "../session/start-from-draw";
import { G1_LEVELS } from "./draw.test.fixture";
import { buildMatchStart } from "./match-start";
import golden from "./match-start.g1.json";
import { g1Input, g1UuidArrangement, preGameSettings, uuidOf } from "./pre-game.test.fixture";

const MATCH_ID = golden.matchId;
const ORIGIN = { groupId: "g1", roundId: "r1" };

function built(input = g1Input()) {
  const payload = buildMatchStart(input, MATCH_ID);
  if (!payload.ok) throw new Error("not built");
  return payload.value;
}

/** Every key and every text of a JSON value, to find a level, a name or a position anywhere. */
function leaves(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...leaves(inner)]);
  }
  return [String(value)];
}

describe("buildMatchStart: the G1 draw becomes the MatchStarted (golden, D7)", () => {
  test("best of 3 to 25, 5x1 and A serving give the exact payload of the fixture", () => {
    expect(built()).toEqual(golden);
  });

  test("the payload passes the parser and the startMatch of the engine", () => {
    const payload = built();
    expect(parseMatchStartedPayload(payload).ok).toBe(true);
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  test("no level, name nor position in it: only IDs and rules", () => {
    const words = leaves(built()).map((word) => word.toLowerCase());
    const forbidden = [
      "level",
      "leveltenths",
      "nickname",
      "primaryposition",
      "pedro",
      "gabi",
      "setter",
      "outsidehitter",
    ];
    expect(words.filter((word) => forbidden.includes(word))).toEqual([]);
    const levels = new Set(Object.values(G1_LEVELS).map(String));
    expect(words.filter((word) => levels.has(word))).toEqual([]);
  });

  test("the round without rotation gives null rotations", () => {
    const settings = preGameSettings((s) => withLeaf(s, "rotation.enabled", false));
    expect(built(g1Input({}, settings)).rotations).toEqual({ a: null, b: null });
  });

  test("a team of five (10 confirmed) has the rotation off", () => {
    const arrangement = g1UuidArrangement(
      [
        ["ana", "joao", "pedro", "lia", "marcos"],
        ["rafa", "duda", "caio", "nina", "leo"],
      ],
      [],
    );
    expect(built(g1Input({}, preGameSettings(), arrangement)).rotations).toEqual({
      a: null,
      b: null,
    });
  });

  test("the tie-break off gives tieBreakPoints null; the choices of the 08 win over the round", () => {
    const settings = preGameSettings((s) => withLeaf(s, "scoring.tieBreakEnabled", false));
    const payload = built(g1Input({ bestOf: 5, pointsPerSet: 21, firstServer: "b" }, settings));
    expect(payload.scoring).toEqual({
      bestOf: 5,
      pointsPerSet: 21,
      tieBreakPoints: null,
      winMargin: 2,
    });
    expect(payload.firstServer).toBe("b");
  });

  test("9 in 2x2: teams 3 and 4 wait in the queue, in order, and the reserve after them", () => {
    const arrangement = g1UuidArrangement(
      [
        ["ana", "joao"],
        ["pedro", "lia"],
        ["marcos", "bia"],
        ["rafa", "duda"],
      ],
      ["caio"],
    );
    const payload = built(g1Input({}, preGameSettings(), arrangement));
    expect(payload.queue).toEqual({
      teams: [
        { memberIds: [uuidOf("marcos"), uuidOf("bia")] },
        { memberIds: [uuidOf("rafa"), uuidOf("duda")] },
      ],
      players: [uuidOf("caio")],
    });
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  test("a draw of one team is refused before the engine", () => {
    const arrangement = g1UuidArrangement([["ana", "joao", "pedro", "lia"]], []);
    expect(buildMatchStart(g1Input({}, preGameSettings(), arrangement), MATCH_ID)).toEqual({
      ok: false,
      error: "not-enough-teams",
    });
  });
});

describe("startFromDraw: from the 08 to the court (D7, fakes)", () => {
  function runtime() {
    const ids = createSequentialIdGenerator();
    return {
      log: createFakeCourtEventLog(ids),
      replayer: createCourtReplayer(),
      ids,
      sync: signedInCourtSyncHooks({ key: "key-a" }),
    };
  }

  test("opens the session of the round, writes one MatchStarted and gives the court route", async () => {
    const court = runtime();

    const started = await startFromDraw(court, ORIGIN, g1Input());

    const session = await court.log.findOpenSessionOfRound("r1");
    expect(session.ok && session.value !== null).toBe(true);
    const id = session.ok ? (session.value ?? "") : "";
    expect(started).toEqual({ ok: true, value: id });
    const stored = await court.log.load(id);
    expect(stored.ok ? stored.value.events.map((event) => event.type) : []).toEqual([
      "MatchStarted",
    ]);
  });

  test("the replay shows 0-0, A serving and the setter of each team in zone 1", async () => {
    const court = runtime();
    await startFromDraw(court, ORIGIN, g1Input());
    const session = await court.log.findOpenSessionOfRound("r1");
    const state = await sessionState(court, session.ok ? (session.value ?? "") : "");
    const match = state.ok ? state.value.currentMatch : null;

    expect(match?.currentSet?.score).toEqual({ a: 0, b: 0 });
    expect(match?.currentSet?.servingTeam).toBe("a");
    const { a, b } = match?.rotations ?? { a: null, b: null };
    expect(a === null ? null : getServingPlayer(a.lineup, a.setterZone)).toBe(uuidOf("pedro"));
    expect(b === null ? null : getServingPlayer(b.lineup, b.setterZone)).toBe(uuidOf("gabi"));
  });

  test("a second start with the match on is refused as an open match", async () => {
    const court = runtime();
    await startFromDraw(court, ORIGIN, g1Input());

    expect(await startFromDraw(court, ORIGIN, g1Input())).toEqual({
      ok: false,
      error: "match-open",
    });
  });
});
