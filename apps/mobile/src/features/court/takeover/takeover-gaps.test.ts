import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { CourtSessionSummary } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { selectSyncNotice } from "../sync/sync-notice";
import { blockedCourtOf } from "./blocked-court";
import { takeOverView, type TakeOverInput } from "./takeover-view";
import { INITIAL_TAKEOVER_STATE, takeoverReducer } from "./takeover.reducer";
import { createPhone, openAndScore, scorePoints } from "./takeover.test.fixture";
import { createFakeCourtStreamServer } from "../sync/fake-court-stream-server.test.fixture";

const SUMMARY: CourtSessionSummary = {
  courtSessionId: "c0000000-0000-4000-8000-00000000000a",
  currentBatch: 1,
  eventCount: 3,
  writer: null,
  lastEventAt: null,
  scoreboard: null,
} as unknown as CourtSessionSummary;
const FOUND: TakeOverInput = {
  lookup: { status: "found", summary: SUMMARY },
  refreshing: false,
  members: [],
  state: INITIAL_TAKEOVER_STATE,
  unsentPoints: 0,
};
const UI_FILES = [
  "TakeOverDialog",
  "TakeOverScreen",
  "BlockedCourtScreen",
  "RefusedPointsSheet",
  "ScoreBackdrop",
  "TakenOverBanner",
  "CourtBlockedView",
];
const FIXED_LAYOUT =
  /\b(?:width|height|padding\w*|margin\w*|fontSize|gap|borderRadius|top|left|right|bottom|minHeight|minWidth|lineHeight)\s*:\s*-?\d/;

describe("E4.11 part 3, extra cases (tester)", () => {
  test("no screen offers Só olhar anywhere in the court texts", () => {
    expect(JSON.stringify(strings.court)).not.toContain("Só olhar");
  });

  test("layout of the new screens has no fixed unit in styles (frontend.md)", () => {
    for (const name of UI_FILES) {
      const source = readFileSync(new URL(`../ui/${name}.tsx`, import.meta.url), "utf8");
      expect(FIXED_LAYOUT.test(source), name).toBe(false);
    }
  });

  test("Voltar is off in every busy step and on while reading, confirming or failed", () => {
    const states = [
      { status: "taking-over" },
      { status: "importing", imported: 1, total: 4 },
      { status: "done", courtSessionId: SESSION_A },
    ] as const;
    for (const state of states) {
      expect(takeOverView({ ...FOUND, state }, 0).canGoBack).toBe(false);
    }
    expect(takeOverView({ ...FOUND, lookup: undefined }, 0).canGoBack).toBe(true);
    expect(takeOverView(FOUND, 0).canGoBack).toBe(true);
    const failed = { status: "failed", reason: "writers-limit" } as const;
    expect(takeOverView({ ...FOUND, state: failed }, 0).canGoBack).toBe(true);
  });

  test("a failed summary read with writers-limit has no retry either", () => {
    const lookup = { status: "failed", reason: "writers-limit" } as const;
    expect(takeOverView({ ...FOUND, lookup }, 0).action).toEqual({ kind: "none" });
  });

  test("stream-changed while busy goes back to confirming with the notice", () => {
    const busy = takeoverReducer(INITIAL_TAKEOVER_STATE, { type: "confirmed" });
    const after = takeoverReducer(busy, { type: "stream-changed" } as never);
    expect(after).toEqual({ status: "confirming", streamChanged: true });
  });

  test("the unsent-points line counts one and many, and is absent with none", () => {
    expect(takeOverView({ ...FOUND, unsentPoints: 1 }, 0).leftOut).toBe(
      strings.court.discard.title(1),
    );
    expect(takeOverView({ ...FOUND, unsentPoints: 7 }, 0).leftOut).toContain("7 pontos");
    expect(takeOverView({ ...FOUND, unsentPoints: 0 }, 0).leftOut).toBeNull();
  });

  test("marking the refused as seen twice at once is harmless and keeps the points out", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const court = await openAndScore(a, SESSION_A, 3);
    a.network.set(false);
    await scorePoints(court, 1);
    const snapshot = court.getSnapshot();
    if (snapshot.status !== "ready") throw new Error(snapshot.status);
    expect(blockedCourtOf(snapshot, selectSyncNotice(snapshot.sync), a.replayer)).toBeNull();
    await Promise.all([court.markRefusedSeen(), court.markRefusedSeen()]);
    const after = court.getSnapshot();
    if (after.status !== "ready") throw new Error(after.status);
    expect(blockedCourtOf(after, selectSyncNotice(after.sync), a.replayer)).toBeNull();
  });
});
