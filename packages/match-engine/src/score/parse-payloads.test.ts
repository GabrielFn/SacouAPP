import { describe, expect, test } from "vitest";

import {
  parseMatchEndedPayload,
  parseMatchStartedPayload,
  parsePointScoredPayload,
  parseScorePayload,
  parseSetEndedPayload,
} from "./parse-payloads.js";

const MATCH_ID = "f0000000-0000-4000-8000-000000000001";
const MEMBER_A = "a0000000-0000-4000-8000-000000000001";
const MEMBER_B = "b0000000-0000-4000-8000-000000000001";
const CANARY = "CANARY-do-not-echo";

const VALID_POINT = { matchId: MATCH_ID, setNumber: 1, team: "a" };
const VALID_START = {
  matchId: MATCH_ID,
  rulesVersion: 1,
  formationsVersion: 1,
  scoring: { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 },
  teams: { a: { memberIds: [MEMBER_A] }, b: { memberIds: [MEMBER_B] } },
  firstServer: "a",
  rotations: { a: null, b: null },
};
const LINEUP_A = [1, 2, 3, 4, 5, 6].map((n) => `a0000000-0000-4000-8000-00000000000${String(n)}`);
const WITH_LINEUP = {
  ...VALID_START,
  teams: { ...VALID_START.teams, a: { memberIds: LINEUP_A } },
  rotations: {
    a: { bench: [], libero: null, lineup: LINEUP_A, setterZone: 2, system: "5x1" },
    b: null,
  },
};
const VALID_NEXT_SET = {
  targetPoints: 25,
  firstServer: "b",
  setterZones: { a: 1, b: null },
};
const VALID_SET_ENDED = { matchId: MATCH_ID, setNumber: 1, winner: "a", nextSet: VALID_NEXT_SET };

function fieldOf(result: ReturnType<typeof parseScorePayload>) {
  return result.ok ? null : result.error.field;
}

describe("input that JSON cannot produce", () => {
  test("a polluted Object.prototype does not supply a missing field", () => {
    const { team, ...withoutTeam } = VALID_POINT;
    const polluted = Object.prototype as Record<string, unknown>;
    polluted["team"] = team;
    try {
      expect(fieldOf(parsePointScoredPayload(withoutTeam))).toBe("team");
    } finally {
      delete polluted["team"];
    }
  });

  test("a polluted Object.prototype does not supply a nested field", () => {
    const { winMargin, ...withoutMargin } = VALID_START.scoring;
    const polluted = Object.prototype as Record<string, unknown>;
    polluted["winMargin"] = winMargin;
    try {
      const input = { ...VALID_START, scoring: withoutMargin };
      expect(fieldOf(parseMatchStartedPayload(input))).toBe("scoring.winMargin");
    } finally {
      delete polluted["winMargin"];
    }
  });

  test.each(["a", "b"] as const)(
    "a polluted Object.prototype does not make rotations.%s a missing null",
    (side) => {
      const other = side === "a" ? "b" : "a";
      const polluted = Object.prototype as Record<string, unknown>;
      polluted[side] = null;
      try {
        const input = { ...VALID_START, rotations: { [other]: null } };
        expect(fieldOf(parseMatchStartedPayload(input))).toBe(`rotations.${side}`);
      } finally {
        Reflect.deleteProperty(polluted, side);
      }
    },
  );

  test("a polluted Object.prototype does not supply a missing zone of the next set", () => {
    const polluted = Object.prototype as Record<string, unknown>;
    polluted["b"] = 1;
    try {
      const input = {
        ...VALID_SET_ENDED,
        nextSet: { ...VALID_NEXT_SET, setterZones: { a: 1 } },
      };
      expect(fieldOf(parseSetEndedPayload(input))).toBe("nextSet.setterZones.b");
    } finally {
      Reflect.deleteProperty(polluted, "b");
    }
  });

  test("holes in a sparse lineup are rejected", () => {
    const lineup = new Array<string>(LINEUP_A.length);
    lineup[0] = MEMBER_A;
    const input = {
      ...WITH_LINEUP,
      rotations: { a: { bench: [], lineup, setterZone: 1, system: "5x1" }, b: null },
    };

    expect(fieldOf(parseMatchStartedPayload(input))).toBe("rotations.a.lineup");
  });

  test("a symbol key is an unknown field", () => {
    const input = { ...VALID_POINT, [Symbol("extra")]: 1 };

    expect(fieldOf(parsePointScoredPayload(input))).toBe("unknown-field");
  });

  test("a non-enumerable key is an unknown field", () => {
    const input = Object.defineProperty({ ...VALID_POINT }, "email", { value: CANARY });

    expect(fieldOf(parsePointScoredPayload(input))).toBe("unknown-field");
  });

  test("a class instance is not a payload", () => {
    class Point {
      readonly matchId = MATCH_ID;
      readonly setNumber = 1;
      readonly team = "a";
    }

    expect(fieldOf(parsePointScoredPayload(new Point()))).toBe("payload");
  });

  test("an object without a prototype is accepted", () => {
    const input = Object.assign(Object.create(null) as object, VALID_POINT);

    expect(parsePointScoredPayload(input).ok).toBe(true);
  });

  test("a getter that throws fails closed", () => {
    const input = {
      ...VALID_POINT,
      get team(): string {
        throw new Error(CANARY);
      },
    };

    expect(fieldOf(parsePointScoredPayload(input))).toBe("payload");
  });

  test("a proxy that throws fails closed", () => {
    const input = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error(CANARY);
        },
      },
    );

    expect(fieldOf(parsePointScoredPayload(input))).toBe("payload");
  });

  test("holes in a sparse member list are rejected", () => {
    const memberIds = new Array<string>(2);
    memberIds[0] = MEMBER_A;
    const input = { ...VALID_START, teams: { ...VALID_START.teams, a: { memberIds } } };

    expect(fieldOf(parseMatchStartedPayload(input))).toBe("teams.a.memberIds");
  });

  test("NaN and infinity are not numbers of the schema", () => {
    [Number.NaN, Number.POSITIVE_INFINITY].forEach((setNumber) => {
      expect(fieldOf(parsePointScoredPayload({ ...VALID_POINT, setNumber }))).toBe("setNumber");
    });
  });
});

describe("the parsed value", () => {
  test("is detached from the input and keeps the member order", () => {
    const memberIds = [MEMBER_B, MEMBER_A];
    const input = {
      ...VALID_START,
      teams: {
        a: { memberIds },
        b: { memberIds: ["b0000000-0000-4000-8000-000000000002"] },
      },
    };

    const parsed = parseMatchStartedPayload(input);
    memberIds.reverse();

    expect(parsed.ok && parsed.value.teams.a.memberIds).toStrictEqual([MEMBER_B, MEMBER_A]);
  });

  test("has a lineup detached from the input, in the order it came", () => {
    const lineup = [...LINEUP_A];
    const input = {
      ...WITH_LINEUP,
      rotations: { a: { bench: [], libero: null, lineup, setterZone: 2, system: "5x1" }, b: null },
    };

    const parsed = parseMatchStartedPayload(input);
    lineup.reverse();

    expect(parsed.ok && parsed.value.rotations.a?.lineup).toStrictEqual(LINEUP_A);
  });

  test("has the keys of the new levels in UTF-16 order", () => {
    const started = parseMatchStartedPayload(WITH_LINEUP);
    const setEnded = parseSetEndedPayload(VALID_SET_ENDED);

    expect(started.ok && Object.keys(started.value)).toStrictEqual([
      "firstServer",
      "formationsVersion",
      "matchId",
      "rotations",
      "rulesVersion",
      "scoring",
      "teams",
    ]);
    expect(started.ok && Object.keys(started.value.rotations.a ?? {})).toStrictEqual([
      "bench",
      "libero",
      "lineup",
      "setterZone",
      "system",
    ]);
    expect(setEnded.ok && Object.keys(setEnded.value.nextSet ?? {})).toStrictEqual([
      "firstServer",
      "setterZones",
      "targetPoints",
    ]);
  });

  test("has its keys in UTF-16 order, as the envelope copy does", () => {
    const setEnded = parseSetEndedPayload({
      winner: "a",
      setNumber: 1,
      nextSet: null,
      matchId: MATCH_ID,
    });
    const matchEnded = parseMatchEndedPayload({
      winner: "a",
      matchId: MATCH_ID,
      endReason: "manual",
    });

    expect(setEnded.ok && Object.keys(setEnded.value)).toStrictEqual([
      "matchId",
      "nextSet",
      "setNumber",
      "winner",
    ]);
    expect(matchEnded.ok && Object.keys(matchEnded.value)).toStrictEqual([
      "endReason",
      "matchId",
      "winner",
    ]);
  });
});

describe("errors do not echo what was received", () => {
  const inputs: readonly (readonly [string, unknown])[] = [
    ["MatchStarted", { ...VALID_START, matchId: CANARY }],
    ["MatchStarted", { ...VALID_START, [CANARY]: 1 }],
    [
      "MatchStarted",
      { ...VALID_START, teams: { ...VALID_START.teams, a: { memberIds: [CANARY] } } },
    ],
    ["MatchStarted", { ...VALID_START, teams: { ...VALID_START.teams, a: { [CANARY]: 1 } } }],
    ["MatchStarted", { ...VALID_START, firstServer: CANARY }],
    ["MatchStarted", { ...VALID_START, rotations: { a: CANARY, b: null } }],
    [
      "MatchStarted",
      {
        ...WITH_LINEUP,
        rotations: { a: { lineup: [CANARY], setterZone: 1, system: "5x1" }, b: null },
      },
    ],
    [
      "MatchStarted",
      {
        ...WITH_LINEUP,
        rotations: { a: { lineup: LINEUP_A, setterZone: CANARY, system: "5x1" }, b: null },
      },
    ],
    ["MatchStarted", { ...VALID_START, rotations: { a: null, b: null, [CANARY]: 1 } }],
    [
      "MatchStarted",
      {
        ...WITH_LINEUP,
        rotations: { a: { lineup: LINEUP_A, setterZone: 1, system: CANARY }, b: null },
      },
    ],
    ["MatchStarted", { ...VALID_START, formationsVersion: CANARY }],
    ["SetEnded", { ...VALID_SET_ENDED, nextSet: { ...VALID_NEXT_SET, firstServer: CANARY } }],
    [
      "SetEnded",
      { ...VALID_SET_ENDED, nextSet: { ...VALID_NEXT_SET, setterZones: { a: CANARY, b: 1 } } },
    ],
    ["PointScored", { ...VALID_POINT, team: CANARY }],
    ["SetEnded", { matchId: MATCH_ID, setNumber: 1, winner: CANARY, nextSet: null }],
    ["MatchEnded", { matchId: MATCH_ID, endReason: CANARY, winner: null }],
    [CANARY, VALID_POINT],
    ["PointScored", CANARY],
  ];

  test.each(inputs)("for %s", (type, payload) => {
    const parsed = parseScorePayload(type, payload);

    expect(parsed.ok).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain(CANARY);
  });
});
