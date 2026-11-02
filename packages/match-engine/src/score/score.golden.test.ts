import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "./appliers.js";
import { parseScorePayload } from "./parse-payloads.js";
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

interface PayloadCase {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly expected: { readonly ok: true } | { readonly ok: false; readonly field: string };
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
const PAYLOAD_CASES = readGolden("score-payloads.json") as readonly PayloadCase[];
const EVENT_CASES = readGolden("score-events.json") as readonly EventCase[];

const FORBIDDEN_NAMES = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];
const STRANGE_KEYS = ["__proto__", "constructor", "1"];

/** Written by hand here, apart from the production shapes, so a dropped field fails the check. */
const SCHEMA_BY_TYPE: readonly {
  readonly type: string;
  readonly fields: readonly string[];
  readonly levels: readonly string[];
}[] = [
  {
    type: "MatchStarted",
    fields: [
      "matchId",
      "rulesVersion",
      "scoring",
      "scoring.bestOf",
      "scoring.pointsPerSet",
      "scoring.tieBreakPoints",
      "scoring.winMargin",
      "teams",
      "teams.a",
      "teams.a.memberIds",
      "teams.b",
      "teams.b.memberIds",
    ],
    levels: ["root", "scoring", "teams", "teams.a", "teams.b"],
  },
  { type: "PointScored", fields: ["matchId", "setNumber", "team"], levels: ["root"] },
  {
    type: "SetEnded",
    fields: ["matchId", "setNumber", "winner", "nextSet", "nextSet.targetPoints"],
    levels: ["root", "nextSet"],
  },
  { type: "MatchEnded", fields: ["matchId", "endReason", "winner"], levels: ["root"] },
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

function expectUniqueIds(cases: readonly { readonly id: string }[]) {
  const ids = cases.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
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
});

describe("score payloads golden", () => {
  test.each(PAYLOAD_CASES)("$id", ({ type, payload, expected }) => {
    const parsed = parseScorePayload(type, payload);

    if (expected.ok) {
      expect(parsed).toStrictEqual({ ok: true, value: payload });
    } else {
      expect(parsed).toStrictEqual({
        ok: false,
        error: { code: "invalid-payload", field: expected.field },
      });
    }
  });

  test("case ids are unique", () => {
    expectUniqueIds(PAYLOAD_CASES);
  });

  describe.each(SCHEMA_BY_TYPE)("coverage of $type", ({ type, fields, levels }) => {
    const ids = new Set(PAYLOAD_CASES.map(({ id }) => id));

    test("has a valid minimum and a case for each missing field", () => {
      expect(ids).toContain(`${type}-valid`);
      expect(fields.filter((field) => !ids.has(`${type}-missing-${field}`))).toStrictEqual([]);
    });

    test("has a case for each forbidden name at each level", () => {
      const missing = levels.flatMap((level) =>
        FORBIDDEN_NAMES.filter((name) => !ids.has(`${type}-forbidden-${name}-at-${level}`)),
      );
      expect(missing).toStrictEqual([]);
    });

    test("has own strange keys at each level, kept by the JSON text", () => {
      const byId = new Map(PAYLOAD_CASES.map((goldenCase) => [goldenCase.id, goldenCase]));
      STRANGE_KEYS.forEach((key) => {
        const payload = byId.get(`${type}-key-${key}-at-root`)?.payload as object;
        expect(Object.keys(payload)).toContain(key);
      });
      const missing = levels.flatMap((level) =>
        STRANGE_KEYS.filter((key) => !ids.has(`${type}-key-${key}-at-${level}`)),
      );
      expect(missing).toStrictEqual([]);
    });
  });
});

describe("score events golden", () => {
  test.each(EVENT_CASES)("$id", (goldenCase) => {
    const outcome = runEventCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("case ids are unique", () => {
    expectUniqueIds(EVENT_CASES);
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
