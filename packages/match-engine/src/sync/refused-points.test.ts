import { describe, expect, test } from "vitest";

import { attributePoint } from "../attributions/commands.js";
import { undoLastAction } from "../corrections/commands.js";
import { CorrectionPlayer, timelineOf } from "../corrections/correction-player.test.fixture.js";
import type { EventEnvelope } from "../event-log/types.js";
import { confirmSetEnd, shiftRotation, switchServingTeam } from "../score/commands.js";
import { rotationMatchInput } from "../score/match-player.test.fixture.js";
import type { ScoringRules } from "../score/types.js";
import { refusedPoints } from "./refused-points.js";

const OWN_DEVICE = "d0000000-0000-4000-8000-000000000001";
const OTHER_DEVICE = "d0000000-0000-4000-8000-000000000002";
const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const SHORT_SET: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 2, winMargin: 2 };

/** The match start and two points, all stored by the server: sequences 1 to 3. */
const STORED = CorrectionPlayer.start(rotationMatchInput(MD3)).rallies("ab");
const LAST_STORED = STORED.last.sequence;

function refusedOf(player: CorrectionPlayer, lastStoredSequence = LAST_STORED) {
  return refusedPoints(player.timeline(), { deviceId: OWN_DEVICE, lastStoredSequence });
}

function teamsOf(player: CorrectionPlayer, lastStoredSequence = LAST_STORED) {
  return refusedOf(player, lastStoredSequence).map(({ team }) => team);
}

describe("refusedPoints", () => {
  test("lists the three points marked offline after the takeover, with their teams, in order", () => {
    const offline = STORED.rallies("aba");

    expect(refusedOf(offline)).toStrictEqual(
      offline.events.slice(LAST_STORED).map(({ eventId }, index) => ({
        eventId,
        team: ["a", "b", "a"][index],
      })),
    );
  });

  test("does not count a point marked and undone in the same log", () => {
    const offline = STORED.point("a").correct(undoLastAction).point("b");

    expect(teamsOf(offline)).toStrictEqual(["b"]);
  });

  test("does not count a stored point the old phone undid offline", () => {
    const offline = STORED.correct(undoLastAction);

    expect(teamsOf(offline)).toStrictEqual([]);
  });

  test("counts only points: SetEnded, LineupChanged, ServingTeamChanged and PointAttributed are not", () => {
    const start = CorrectionPlayer.start(rotationMatchInput(SHORT_SET));
    const offline = start
      .run((state) => switchServingTeam(state))
      .run((state) => shiftRotation(state, "a", "forward"))
      .rallies("aa");
    const pointId = offline.last.eventId;
    const ended = offline
      .correct((timeline) => attributePoint(timeline, pointId, { kind: "ace", author: null }))
      .run((state) => confirmSetEnd(state, {}));
    const types = new Set(ended.events.map(({ type }) => type));

    expect(types).toStrictEqual(
      new Set([
        "MatchStarted",
        "ServingTeamChanged",
        "LineupChanged",
        "PointScored",
        "PointAttributed",
        "SetEnded",
      ]),
    );
    expect(teamsOf(ended, start.last.sequence)).toStrictEqual(["a", "a"]);
  });

  test("is empty when the server stored the last event of the log", () => {
    expect(refusedOf(STORED.rallies("ab"), LAST_STORED + 2)).toStrictEqual([]);
  });

  test("is empty when every point of the log is of another device", () => {
    const imported: readonly EventEnvelope[] = STORED.rallies("aab").events.map((event) => ({
      ...event,
      deviceId: OTHER_DEVICE,
    }));

    expect(refusedPoints(timelineOf(imported), { deviceId: OWN_DEVICE, lastStoredSequence: 0 })).toStrictEqual([]);
  });

  test("ignores the imported stream of the new writer and counts only the own points", () => {
    const imported = STORED.events.map((event) => ({ ...event, deviceId: OTHER_DEVICE }));
    const own = new CorrectionPlayer(imported).rallies("bb");
    const firstOwnSequence = imported.length + 1;

    expect(teamsOf(own, firstOwnSequence - 1)).toStrictEqual(["b", "b"]);
    expect(teamsOf(own, firstOwnSequence)).toStrictEqual(["b"]);
  });
});
