import { describe, expect, test } from "vitest";

import {
  CorrectionPlayer,
  eventIdOf,
  timelineOf,
} from "../corrections/correction-player.test.fixture.js";
import { revertToEvent, undoLastAction } from "../corrections/commands.js";
import { previewRevert } from "../corrections/preview.js";
import { getRecentPoints } from "../corrections/timeline.js";
import type { CourtSessionTimeline } from "../corrections/types.js";
import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import type { EventEnvelope } from "../event-log/types.js";
import { changeLineup, confirmSetEnd, shiftRotation, startMatch } from "../score/commands.js";
import {
  BLUE_LINEUP,
  COURT_SESSION_ID,
  MATCH_ID,
  numberedMatchId,
  ORANGE_LINEUP,
  rotationMatchInput,
  type RotationSetup,
} from "../score/match-player.test.fixture.js";
import type { MemberId, PointKind, ScoringRules } from "../score/types.js";
import { attributePoint } from "./commands.js";
import { resolvePointAttributions } from "./resolve.js";
import type { PointAuthorship } from "./types.js";
import { getUnattributedPoints } from "./unattributed.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const SINGLE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 2,
  tieBreakPoints: null,
  winMargin: 2,
};

const [PEDRO, ANA, LIA, , , JOAO] = ORANGE_LINEUP;
const [GABI, , CAIO] = BLUE_LINEUP;
/** The first member after the lineup: the libero when the setup turns it on, else on the bench. */
const ORANGE_SEVENTH = "a0000000-0000-4000-8000-000000000007";
const BLUE_SEVENTH = "b0000000-0000-4000-8000-000000000007";
const ORANGE_EIGHTH = "a0000000-0000-4000-8000-000000000008";
const SECOND_DEVICE = "d0000000-0000-4000-8000-000000000002";

function refused(code: string) {
  return { ok: false, error: { code } };
}

function attack(author: MemberId | undefined): PointAuthorship {
  return { kind: "attack", author: author ?? null };
}

function of(kind: PointKind, author: MemberId | undefined): PointAuthorship {
  return { kind, author: author ?? null };
}

function attributionDraft(pointEventId: string, authorship: PointAuthorship, matchId = MATCH_ID) {
  return {
    ok: true,
    value: [
      {
        type: "PointAttributed",
        payload: { author: authorship.author, kind: authorship.kind, matchId, pointEventId },
      },
    ],
  };
}

function answer(
  player: CorrectionPlayer,
  pointSequence: number,
  authorship: PointAuthorship,
): CorrectionPlayer {
  const result = attributePoint(player.timeline(), eventIdOf(pointSequence), authorship);
  if (!result.ok) {
    throw new Error(`refused: ${result.error.code}`);
  }
  return result.value.reduce<CorrectionPlayer>((current, draft) => current.append(draft), player);
}

function start(setup: RotationSetup = {}, scoring: ScoringRules = MD3): CorrectionPlayer {
  return CorrectionPlayer.start(rotationMatchInput(scoring, setup));
}

/** Laranja (a) in zone 1 serves first; Azul (b) in zone 5. */
function screenMatch(): CorrectionPlayer {
  return start({ zones: [1, 5] });
}

function attribute(
  timeline: CourtSessionTimeline,
  pointSequence: number,
  authorship: PointAuthorship,
) {
  return attributePoint(timeline, eventIdOf(pointSequence), authorship);
}

describe("attributePoint: who may score the point", () => {
  test("Laranja serving at 19–15 and an attack of Pedro in position 2: recorded", () => {
    // Set 2 of screen 24 at 18–15, João serving in slot 1 and Pedro in slot 2 (83 events).
    let player = screenMatch()
      .rallies(`${"b".repeat(22)}${"a".repeat(25)}`)
      .run(confirmSetEnd)
      .rallies(`${"a".repeat(12)}${"b".repeat(11)}aabbaabbaa`);
    player = player.point("a");

    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 19, b: 15 });
    expect(attribute(player.timeline(), 83, attack(PEDRO))).toStrictEqual(
      attributionDraft(eventIdOf(83), attack(PEDRO)),
    );
  });

  test("someone of the other team, or on the bench, is refused", () => {
    let player = start({ zones: [1, 5], teamSize: 7 });
    player = player.point("a");
    const timeline = player.timeline();

    expect(attribute(timeline, 2, attack(GABI))).toStrictEqual(refused("invalid-point-author"));
    expect(attribute(timeline, 2, attack(ORANGE_SEVENTH))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("the libero out of the court in that rally is refused", () => {
    // Covering Lia (index 2) in zone 1, the libero would be in the front row: it is out.
    let player = start({ zones: [1, 5], teamSize: 8, liberoIndexes: [[2], null] });
    player = player.point("a");
    const timeline = player.timeline();

    expect(attribute(timeline, 2, attack(ORANGE_SEVENTH))).toStrictEqual(
      refused("invalid-point-author"),
    );
    expect(attribute(timeline, 2, attack(LIA))).toStrictEqual(
      attributionDraft(eventIdOf(2), attack(LIA)),
    );
    expect(attribute(timeline, 2, attack(ORANGE_EIGHTH))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("the libero on the court in the rally is accepted after a girar or a lineup change", () => {
    // The diagonal 2–5 puts the libero in slot 6, for João, in zone 1.
    let player = start({ zones: [1, 5], teamSize: 7, liberoIndexes: [[2, 5], null] });
    player = player.point("a");
    player = player.run((state) => shiftRotation(state, "a", "forward"));
    player = player.run((state) =>
      changeLineup(state, "a", {
        bench: [ORANGE_SEVENTH],
        libero: null,
        lineup: ORANGE_LINEUP,
        setterZone: 6,
      }),
    );

    expect(attribute(player.timeline(), 2, attack(ORANGE_SEVENTH))).toStrictEqual(
      attributionDraft(eventIdOf(2), attack(ORANGE_SEVENTH)),
    );
    expect(attribute(player.timeline(), 2, attack(JOAO))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("on a side-out the court is the one before the rotation", () => {
    // Azul in zone 3 receives, with the libero for Caio in slot 5; after rotating to zone 2 the
    // libero would be in the front row and Caio back on the court.
    let player = start({ zones: [1, 3], teamSize: 7, liberoIndexes: [null, [2]] });
    player = player.point("b");

    expect(player.state().currentMatch?.rotations.b?.setterZone).toBe(2);
    expect(attribute(player.timeline(), 2, attack(BLUE_SEVENTH))).toStrictEqual(
      attributionDraft(eventIdOf(2), attack(BLUE_SEVENTH)),
    );
    expect(attribute(player.timeline(), 2, attack(CAIO))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("with the rotation of the team off, anyone of the team", () => {
    let player = start({ zones: [null, 5] });
    player = player.point("a");

    ORANGE_LINEUP.forEach((memberId) => {
      expect(attribute(player.timeline(), 2, attack(memberId)).ok).toBe(true);
    });
    expect(attribute(player.timeline(), 2, attack(GABI))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });
});

describe("attributePoint: kind and author together", () => {
  test("every kind with an author but the error of the opponent, which has none", () => {
    let player = screenMatch();
    player = player.point("a");
    const timeline = player.timeline();

    (["attack", "block", "other"] as const).forEach((kind) => {
      expect(attribute(timeline, 2, of(kind, ANA))).toStrictEqual(
        attributionDraft(eventIdOf(2), of(kind, ANA)),
      );
      expect(attribute(timeline, 2, of(kind, undefined))).toStrictEqual(
        refused("invalid-point-author"),
      );
    });
    expect(attribute(timeline, 2, of("opponent-error", undefined))).toStrictEqual(
      attributionDraft(eventIdOf(2), of("opponent-error", undefined)),
    );
    expect(attribute(timeline, 2, of("opponent-error", ANA))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("a kind outside the list is refused, whatever its case", () => {
    let player = screenMatch();
    player = player.point("a");

    ["Ace", "serve", "", "toString", "__proto__"].forEach((kind) => {
      expect(
        attribute(player.timeline(), 2, {
          kind: kind as unknown as PointKind,
          author: PEDRO ?? null,
        }),
      ).toStrictEqual(refused("invalid-point-kind"));
    });
  });

  test("an author that is not a lowercase id is refused", () => {
    let player = screenMatch();
    player = player.point("a");

    [PEDRO?.toUpperCase(), "player@example.com", "Pedro"].forEach((author) => {
      expect(attribute(player.timeline(), 2, attack(author))).toStrictEqual(
        refused("invalid-point-author"),
      );
    });
  });
});

describe("attributePoint: what can be an ace or a block (P1)", () => {
  test("an ace only of the server of the rally", () => {
    let player = screenMatch();
    player = player.point("a");
    const timeline = player.timeline();

    expect(attribute(timeline, 2, of("ace", PEDRO)).ok).toBe(true);
    expect(attribute(timeline, 2, of("ace", ANA))).toStrictEqual(refused("invalid-point-author"));
  });

  test("no ace for the team that received", () => {
    let player = screenMatch();
    player = player.point("b");

    BLUE_LINEUP.forEach((memberId) => {
      expect(attribute(player.timeline(), 2, of("ace", memberId))).toStrictEqual(
        refused("invalid-point-author"),
      );
    });
  });

  test("with the rotation off, an ace of anyone of the team only if it served", () => {
    let player = start({ zones: [null, null] });
    player = player.rallies("ab");

    expect(attribute(player.timeline(), 2, of("ace", JOAO)).ok).toBe(true);
    expect(attribute(player.timeline(), 3, of("ace", GABI))).toStrictEqual(
      refused("invalid-point-author"),
    );
  });

  test("the libero on the court never has an ace nor a block, and may have an attack", () => {
    let player = start({ zones: [1, 5], teamSize: 7, liberoIndexes: [[2, 5], null] });
    player = player.point("a");
    const timeline = player.timeline();

    expect(attribute(timeline, 2, of("ace", ORANGE_SEVENTH))).toStrictEqual(
      refused("invalid-point-author"),
    );
    expect(attribute(timeline, 2, of("block", ORANGE_SEVENTH))).toStrictEqual(
      refused("invalid-point-author"),
    );
    expect(attribute(timeline, 2, of("other", ORANGE_SEVENTH)).ok).toBe(true);
  });
});

describe("attributePoint: the target", () => {
  test("refuses an event that is not a point, a reverted point and an id not in the log", () => {
    let player = start({ zones: [1, 5] }, SINGLE_SHORT_SET);
    player = player.rallies("ab");
    player = player.correct(undoLastAction);
    player = player.point("a");

    [1, 3, 99].forEach((sequence) => {
      expect(attribute(player.timeline(), sequence, attack(PEDRO))).toStrictEqual(
        refused("invalid-attribution-target"),
      );
    });
    expect(attributePoint(player.timeline(), "player@example.com", attack(PEDRO))).toStrictEqual(
      refused("invalid-attribution-target"),
    );
  });

  test("refuses a SetEnded and a point of an earlier match", () => {
    let player = start({ zones: [1, 5] }, SINGLE_SHORT_SET);
    player = player.rallies("aa");
    player = player.run(confirmSetEnd);
    player = player.run((state) =>
      startMatch(state, rotationMatchInput(SINGLE_SHORT_SET, { matchId: numberedMatchId(2) })),
    );
    player = player.point("a");

    [2, 4].forEach((sequence) => {
      expect(attribute(player.timeline(), sequence, attack(PEDRO))).toStrictEqual(
        refused("invalid-attribution-target"),
      );
    });
    expect(attribute(player.timeline(), 7, attack(PEDRO))).toStrictEqual(
      attributionDraft(eventIdOf(7), attack(PEDRO), numberedMatchId(2)),
    );
  });

  test("without an open match there is nothing to fill in (P2)", () => {
    let player = start({ zones: [1, 5] }, SINGLE_SHORT_SET);
    player = player.rallies("aa");
    player = player.run(confirmSetEnd);

    expect(attribute(player.timeline(), 2, attack(PEDRO))).toStrictEqual(refused("no-open-match"));
    expect(attribute(timelineOf([]), 2, attack(PEDRO))).toStrictEqual(refused("no-open-match"));
  });

  test("a decided set before its SetEnded, and a point of the set before, are accepted", () => {
    let player = screenMatch();
    player = player.rallies("a".repeat(25));
    const decided = player.timeline();
    player = player.run(confirmSetEnd).point("b");

    expect(attribute(decided, 26, attack(PEDRO)).ok).toBe(true);
    expect(attribute(player.timeline(), 26, attack(PEDRO)).ok).toBe(true);
  });
});

describe("filling in later", () => {
  test("three points without an answer and the second filled in five points later", () => {
    let player = screenMatch();
    player = player.rallies("aaa");
    player = player.rallies("aaaaa");
    player = answer(player, 3, attack(ANA));

    expect(resolvePointAttributions(player.timeline())).toStrictEqual([
      {
        pointEventId: eventIdOf(3),
        matchId: MATCH_ID,
        setNumber: 1,
        team: "a",
        kind: "attack",
        author: ANA,
      },
    ]);
    expect(getUnattributedPoints(player.timeline()).map(({ eventId }) => eventId)).toStrictEqual(
      [2, 4, 5, 6, 7, 8, 9].map(eventIdOf),
    );
  });

  test("answering again: the last one wins", () => {
    let player = screenMatch();
    player = player.point("a");
    player = answer(player, 2, attack(ANA));
    player = answer(player, 2, of("block", LIA));

    expect(
      resolvePointAttributions(player.timeline()).map(({ kind, author }) => [kind, author]),
    ).toStrictEqual([["block", LIA]]);
  });

  test("an error of the opponent is an answer, so the point is not left to fill in", () => {
    let player = screenMatch();
    player = player.rallies("ab");
    player = answer(player, 2, of("opponent-error", undefined));

    expect(getUnattributedPoints(player.timeline()).map(({ eventId }) => eventId)).toStrictEqual([
      eventIdOf(3),
    ]);
  });

  test("getUnattributedPoints lists only the set of screen 24", () => {
    let player = screenMatch();
    player = player.rallies("a".repeat(25));
    player = player.run(confirmSetEnd).point("b");

    expect(getUnattributedPoints(player.timeline()).map(({ eventId }) => eventId)).toStrictEqual([
      eventIdOf(28),
    ]);
    expect(getUnattributedPoints(timelineOf([]))).toStrictEqual([]);
  });

  test("getRecentPoints shows who scored, and nulls for the points without an answer", () => {
    let player = screenMatch();
    player = player.rallies("ab");
    player = answer(player, 2, of("ace", PEDRO));
    const [last, first] = getRecentPoints(player.timeline());

    expect([first?.author, first?.kind, last?.author, last?.kind]).toStrictEqual([
      PEDRO,
      "ace",
      null,
      null,
    ]);
  });
});

describe("corrections of an attribution (D7)", () => {
  test("DESFAZER right after filling in removes only the answer; again, the point", () => {
    let player = screenMatch();
    player = player.point("a");
    player = answer(player, 2, attack(ANA));
    player = player.correct(undoLastAction);

    expect(resolvePointAttributions(player.timeline())).toStrictEqual([]);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 1, b: 0 });
    player = player.correct(undoLastAction);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 0, b: 0 });
  });

  test("going back to a point before a late answer removes it, and the preview counts it", () => {
    let player = screenMatch();
    player = player.rallies("aaa");
    player = answer(player, 2, attack(ANA));
    const timeline = player.timeline();
    const preview = previewRevert(timeline, eventIdOf(3));

    expect(preview.ok ? preview.value.removed : null).toStrictEqual({
      points: 1,
      lineupChanges: 0,
      queueChanges: 0,
      servingChanges: 0,
      setEnds: 0,
      attributions: 1,
    });
    player = player.correct((current) => revertToEvent(current, eventIdOf(3)));
    expect(resolvePointAttributions(player.timeline())).toStrictEqual([]);
  });

  test("an answer to a point reverted later is ignored", () => {
    let player = screenMatch();
    player = player.rallies("aa");
    player = answer(player, 3, attack(ANA));
    player = player.correct((timeline) => revertToEvent(timeline, eventIdOf(2)));

    expect(resolvePointAttributions(player.timeline())).toStrictEqual([]);
  });
});

function envelopeOf(
  raw: Readonly<Record<string, unknown>>,
  overrides: Readonly<Record<string, unknown>>,
): EventEnvelope {
  const parsed = parseEventEnvelope({ ...raw, ...overrides });
  if (!parsed.ok) {
    throw new Error(`invalid envelope: ${parsed.error.field}`);
  }
  return parsed.value;
}

describe("two writers", () => {
  test("an answer before its point in the canonical order still counts", () => {
    let player = screenMatch();
    player = player.point("a");
    const [started, point] = player.events;
    const early = envelopeOf(
      { courtSessionId: COURT_SESSION_ID, batch: 1, schemaVersion: 1, type: "PointAttributed" },
      {
        eventId: "e0000000-0000-4000-8000-0000000000aa",
        deviceId: SECOND_DEVICE,
        sequence: 1,
        payload: { author: ANA, kind: "attack", matchId: MATCH_ID, pointEventId: eventIdOf(2) },
      },
    );
    if (started === undefined || point === undefined) {
      throw new Error("the match has no point");
    }
    const timeline = timelineOf([early, started, point]);

    expect(timeline.entries.map(({ event }) => event.type)).toStrictEqual([
      "MatchStarted",
      "PointAttributed",
      "PointScored",
    ]);
    expect(resolvePointAttributions(timeline).map(({ author }) => author)).toStrictEqual([ANA]);
  });
});
