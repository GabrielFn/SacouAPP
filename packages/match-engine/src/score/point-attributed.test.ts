import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { POINT_ATTRIBUTED_EVENT_TYPE } from "./constants.data.js";
import {
  BLUE_LINEUP,
  MATCH_ID,
  numberedMatchId,
  ORANGE_LINEUP,
  replayAll,
  rotationMatchInput,
  toEnvelope,
} from "./match-player.test.fixture.js";
import { parsePointAttributedPayload, parseScorePayload } from "./parse-payloads.js";
import type {
  CourtSessionState,
  PointAttributedPayload,
  ScoreCommandResult,
  ScoringRules,
} from "./types.js";

const POINT_EVENT_ID = "e0000000-0000-4000-8000-000000000002";
const OUTSIDER = "90000000-0000-4000-8000-000000000001";
const CANARY = "CANARY-do-not-echo";
const [PEDRO] = ORANGE_LINEUP;
const [GABI] = BLUE_LINEUP;
const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };

const VALID: PointAttributedPayload = {
  author: PEDRO ?? null,
  kind: "attack",
  matchId: MATCH_ID,
  pointEventId: POINT_EVENT_ID,
};

function fieldOf(result: ReturnType<typeof parsePointAttributedPayload>): string | null {
  return result.ok ? null : result.error.field;
}

describe("parsePointAttributedPayload", () => {
  test("accepts each kind with an author, and the error of the opponent without one", () => {
    (["attack", "block", "ace", "other"] as const).forEach((kind) => {
      expect(parsePointAttributedPayload({ ...VALID, kind })).toStrictEqual({
        ok: true,
        value: { ...VALID, kind },
      });
    });
    expect(parsePointAttributedPayload({ ...VALID, kind: "opponent-error", author: null }).ok).toBe(
      true,
    );
  });

  test("an author that does not match the kind is reported as the author", () => {
    expect(fieldOf(parsePointAttributedPayload({ ...VALID, author: null }))).toBe("author");
    expect(fieldOf(parsePointAttributedPayload({ ...VALID, kind: "opponent-error" }))).toBe(
      "author",
    );
  });

  test("a missing author is invalid, even for the error of the opponent", () => {
    const withoutAuthor = { kind: VALID.kind, matchId: MATCH_ID, pointEventId: POINT_EVENT_ID };

    expect(fieldOf(parsePointAttributedPayload(withoutAuthor))).toBe("author");
    expect(fieldOf(parsePointAttributedPayload({ ...withoutAuthor, kind: "opponent-error" }))).toBe(
      "author",
    );
  });

  test("ids must be lowercase UUIDs", () => {
    const upper = POINT_EVENT_ID.toUpperCase();

    expect(fieldOf(parsePointAttributedPayload({ ...VALID, matchId: upper }))).toBe("matchId");
    expect(fieldOf(parsePointAttributedPayload({ ...VALID, pointEventId: upper }))).toBe(
      "pointEventId",
    );
    expect(fieldOf(parsePointAttributedPayload({ ...VALID, author: upper }))).toBe("author");
  });

  test("a kind outside the list, of another case or type, is the kind", () => {
    ["Ace", "serve", "", 1, null, ["ace"]].forEach((kind) => {
      expect(fieldOf(parsePointAttributedPayload({ ...VALID, kind }))).toBe("kind");
    });
  });

  test("validates in order: unknown, matchId, pointEventId, kind, author", () => {
    const broken = { matchId: 1, pointEventId: 1, kind: "Ace", author: 1 };

    expect(fieldOf(parsePointAttributedPayload({ ...broken, extra: 1 }))).toBe("unknown-field");
    expect(fieldOf(parsePointAttributedPayload(broken))).toBe("matchId");
    expect(fieldOf(parsePointAttributedPayload({ ...broken, matchId: MATCH_ID }))).toBe(
      "pointEventId",
    );
    expect(
      fieldOf(
        parsePointAttributedPayload({ ...broken, matchId: MATCH_ID, pointEventId: POINT_EVENT_ID }),
      ),
    ).toBe("kind");
  });

  test("the parsed value has its keys in alphabetical order", () => {
    const parsed = parsePointAttributedPayload({
      pointEventId: POINT_EVENT_ID,
      matchId: MATCH_ID,
      kind: "attack",
      author: PEDRO,
    });

    expect(parsed.ok ? Object.keys(parsed.value) : null).toStrictEqual([
      "author",
      "kind",
      "matchId",
      "pointEventId",
    ]);
  });

  test("a polluted Object.prototype does not supply a missing author", () => {
    const { author, ...withoutAuthor } = VALID;
    const polluted = Object.prototype as Record<string, unknown>;
    polluted["author"] = author;
    try {
      expect(fieldOf(parsePointAttributedPayload(withoutAuthor))).toBe("author");
    } finally {
      delete polluted["author"];
    }
  });

  test("an inherited key is not read and a prototype other than Object is not a payload", () => {
    const inherited = Object.create(VALID) as object;

    expect(fieldOf(parsePointAttributedPayload(inherited))).toBe("payload");
    expect(fieldOf(parsePointAttributedPayload(Object.assign(Object.create(null), VALID)))).toBe(
      null,
    );
  });

  test("a getter or a proxy that throws fails closed", () => {
    const withGetter = {
      ...VALID,
      get kind(): string {
        throw new Error(CANARY);
      },
    };
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error(CANARY);
        },
      },
    );

    expect(fieldOf(parsePointAttributedPayload(withGetter))).toBe("payload");
    expect(fieldOf(parsePointAttributedPayload(proxy))).toBe("payload");
  });

  test("errors never echo what was received", () => {
    [
      { ...VALID, matchId: CANARY },
      { ...VALID, pointEventId: CANARY },
      { ...VALID, kind: CANARY },
      { ...VALID, author: CANARY },
      { ...VALID, [CANARY]: 1 },
      CANARY,
    ].forEach((payload) => {
      const parsed = parseScorePayload(POINT_ATTRIBUTED_EVENT_TYPE, payload);

      expect(parsed.ok).toBe(false);
      expect(JSON.stringify(parsed)).not.toContain(CANARY);
    });
  });
});

const applyPointAttributed = SCORE_APPLIERS.get(POINT_ATTRIBUTED_EVENT_TYPE);

function attributionAt(sequence: number, payload: PointAttributedPayload): EventEnvelope {
  return toEnvelope({ type: POINT_ATTRIBUTED_EVENT_TYPE, payload }, sequence);
}

function stateAfter(...commands: readonly ((state: CourtSessionState) => ScoreCommandResult)[]) {
  return commands.reduce<{ state: CourtSessionState; events: readonly EventEnvelope[] }>(
    ({ state, events }, command) => {
      const result = command(state);
      if (!result.ok) {
        throw new Error(`refused: ${result.error.code}`);
      }
      const appended = [
        ...events,
        ...result.value.map((draft, index) => toEnvelope(draft, events.length + index + 1)),
      ];
      return { state: replayAll(appended), events: appended };
    },
    { state: INITIAL_COURT_SESSION_STATE, events: [] },
  ).state;
}

function apply(state: CourtSessionState, payload: PointAttributedPayload) {
  if (applyPointAttributed === undefined) {
    throw new Error("no applier");
  }
  return applyPointAttributed(state, attributionAt(99, payload));
}

const open = (state: CourtSessionState) => startMatch(state, rotationMatchInput(MD3));

describe("applyPointAttributed", () => {
  test("returns the very same state", () => {
    const state = stateAfter(open, (current) => scorePoint(current, "a"));

    expect(apply(state, VALID)).toStrictEqual({ ok: true, value: state });
    const applied = apply(state, VALID);
    expect(applied.ok && applied.value === state).toBe(true);
  });

  test("accepts an author of either team and the error of the opponent", () => {
    const state = stateAfter(open);

    expect(apply(state, { ...VALID, author: GABI ?? null }).ok).toBe(true);
    expect(apply(state, { ...VALID, kind: "opponent-error", author: null }).ok).toBe(true);
  });

  test("accepts a decided set and a closed set of the open match", () => {
    const decided = stateAfter(
      open,
      (state) => scorePoint(state, "a"),
      (state) => scorePoint(state, "a"),
    );
    const closed = stateAfter(
      open,
      (state) => scorePoint(state, "a"),
      (state) => scorePoint(state, "a"),
      confirmSetEnd,
    );

    expect(apply(decided, VALID).ok).toBe(true);
    expect(closed.currentMatch?.currentSet?.setNumber).toBe(2);
    expect(apply(closed, VALID).ok).toBe(true);
  });

  test("accepts the last set between its SetEnded and the MatchEnded", () => {
    const scoreA = (state: CourtSessionState) => scorePoint(state, "a");
    const beforeConfirm = stateAfter(open, scoreA, scoreA, confirmSetEnd, scoreA, scoreA);
    const confirmed = confirmSetEnd(beforeConfirm);
    if (!confirmed.ok) {
      throw new Error("refused");
    }
    const [setEnded] = confirmed.value;
    if (setEnded === undefined) {
      throw new Error("no SetEnded");
    }
    const events = [setEnded].map((draft) => toEnvelope(draft, 1));
    const lastSetClosed = SCORE_APPLIERS.get(setEnded.type)?.(
      beforeConfirm,
      events[0] as EventEnvelope,
    );

    expect(lastSetClosed?.ok).toBe(true);
    const state = lastSetClosed?.ok === true ? lastSetClosed.value : beforeConfirm;
    expect(state.currentMatch).not.toBeNull();
    expect(state.currentMatch?.currentSet).toBeNull();
    expect(apply(state, VALID).ok).toBe(true);
  });

  test("rejects without a match, for another match, after the end and for an outsider", () => {
    const rejected = { ok: false, error: { code: "event-rejected" } };
    const state = stateAfter(open);
    const ended = stateAfter(open, (current) => endMatchManually(current, null));

    expect(apply(INITIAL_COURT_SESSION_STATE, VALID)).toStrictEqual(rejected);
    expect(apply(state, { ...VALID, matchId: numberedMatchId(2) })).toStrictEqual(rejected);
    expect(apply(ended, VALID)).toStrictEqual(rejected);
    expect(apply(state, { ...VALID, author: OUTSIDER })).toStrictEqual(rejected);
  });

  test("rejects a payload the parser refuses", () => {
    const state = stateAfter(open);

    expect(apply(state, { ...VALID, author: null })).toStrictEqual({
      ok: false,
      error: { code: "event-rejected" },
    });
  });
});
