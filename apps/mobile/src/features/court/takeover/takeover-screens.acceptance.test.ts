import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { SESSION_A, SESSION_B } from "../persistence/log-envelopes.test.fixture";
import type { CourtSessionController } from "../session/court-session-controller";
import { readRoundCourt } from "../session/round-court";
import { startCourtMatch } from "../session/start-court-match";
import { accountRef, ROUND, settled } from "../sync/court-sync.test.fixture";
import { createFakeCourtStreamServer } from "../sync/fake-court-stream-server.test.fixture";
import { selectSyncNotice } from "../sync/sync-notice";
import { blockedCourtOf } from "./blocked-court";
import { lookUpCourtSummary, opensTakeover } from "./court-summary-lookup";
import { refusedTexts } from "./takeover-texts";
import {
  createPhone,
  openAndScore,
  scorePoints,
  takeOver,
  type Phone,
} from "./takeover.test.fixture";

const POINTS_OF_A = 10;
const OFFLINE_POINTS_OF_B = 4;

function blockedOf(phone: Phone, controller: CourtSessionController) {
  const snapshot = controller.getSnapshot();
  if (snapshot.status !== "ready") throw new Error(snapshot.status);
  return blockedCourtOf(snapshot, selectSyncNotice(snapshot.sync), phone.replayer);
}

function lookupDeps(phone: Phone, server: ReturnType<typeof createFakeCourtStreamServer>) {
  return {
    api: server.api,
    wait: () => Promise.resolve(),
    account: () => phone.account.current(),
  };
}

describe("the screens of taking the court over (E4.11, part 3, acceptance)", () => {
  test("B8: reopening with refused points not seen shows the 09c; after Entendi, the 09b", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const b = await createPhone(2, server);
    const courtOfA = await openAndScore(a, SESSION_A, POINTS_OF_A);
    expect((await takeOver(b, server)).final.status).toBe("done");
    a.network.set(false);
    await scorePoints(courtOfA, 2);
    a.network.set(true);
    await settled(a.sync);

    const reopened = await a.controller(SESSION_A);
    const first = blockedOf(a, reopened);
    expect(first?.kind).toBe("taken-over");
    expect(first?.kind === "taken-over" && first.refused?.rows.length).toBe(2);
    expect((await reopened.dispatch({ type: "score-point", team: "a" })).ok).toBe(false);

    await reopened.markRefusedSeen();
    expect(blockedOf(a, reopened)).toEqual({ kind: "taken-over", refused: null });
    expect(blockedOf(a, await a.controller(SESSION_A))).toEqual({
      kind: "taken-over",
      refused: null,
    });
  });

  test("B6: B opened offline; its points are refused (other phone first), the 09a imports A's", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const b = await createPhone(2, server);
    await openAndScore(a, SESSION_A, POINTS_OF_A);
    b.network.set(false);
    await b.log.openSession(SESSION_B, { ...ROUND, ownerKey: b.owner.key });
    await startCourtMatch({ courtSessionId: SESSION_B, ...b }, SAMPLE_MATCH_ONE_SET);
    await scorePoints(await b.controller(SESSION_B), OFFLINE_POINTS_OF_B);
    b.network.set(true);
    await settled(b.sync);

    const blocked = blockedOf(b, await b.controller(SESSION_B));
    if (blocked?.kind !== "taken-over" || blocked.refused === null) throw new Error("no 09c");
    expect(blocked.refused.rows).toHaveLength(OFFLINE_POINTS_OF_B);
    expect(blocked.refused.otherPhoneFirst).toBe(true);
    expect(refusedTexts(OFFLINE_POINTS_OF_B, true, null, null).body).toBe(
      strings.court.refused.bodyOtherFirst,
    );
    const lookup = await lookUpCourtSummary(lookupDeps(b, server), ROUND);
    const beforeSeen = await readRoundCourt(b, ROUND.roundId);
    if (!beforeSeen.ok) throw new Error(beforeSeen.error);
    expect(opensTakeover(lookup, beforeSeen.value)).toBe(false);

    await (await b.controller(SESSION_B)).markRefusedSeen();
    const local = await readRoundCourt(b, ROUND.roundId);
    if (!local.ok) throw new Error(local.error);
    expect(opensTakeover(lookup, local.value)).toBe(true);

    expect((await takeOver(b, server)).final).toEqual({
      status: "done",
      courtSessionId: SESSION_A,
    });
    expect(await b.log.findOpenSessionOfRound(ROUND.roundId)).toEqual({
      ok: true,
      value: SESSION_A,
    });
    expect((await b.load(SESSION_A)).events).toEqual(server.stored());
    const after = await readRoundCourt(b, ROUND.roundId);
    expect(
      after.ok &&
        opensTakeover(await lookUpCourtSummary(lookupDeps(b, server), ROUND), after.value),
    ).toBe(false);
  });

  test("S4: on its own account, an old batch with points not sent yet: the 09a says they are left out", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const b = await createPhone(2, server);
    const courtOfA = await openAndScore(a, SESSION_A, POINTS_OF_A);
    expect((await takeOver(b, server)).final.status).toBe("done");
    a.network.set(false);
    await scorePoints(courtOfA, 2);

    const local = await readRoundCourt(a, ROUND.roundId);
    if (!local.ok || local.value === null) throw new Error("no round court");
    expect(local.value).toMatchObject({ takenOver: false, unsentPoints: 2 });
    const lookup = await lookUpCourtSummary(lookupDeps(a, server), ROUND);
    expect(opensTakeover(lookup, local.value)).toBe(true);
  });

  test("S4: another account sees how many unsent points taking over leaves out, and cannot mark", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const court = await openAndScore(a, SESSION_A, 1);
    a.network.set(false);
    await scorePoints(court, 3);

    a.account.switchTo(accountRef("someone-else"));
    await court.reload();

    expect(blockedOf(a, court)).toEqual({ kind: "other-account", unsentPoints: 3 });
    expect((await court.dispatch({ type: "score-point", team: "b" })).ok).toBe(false);
  });

  test("finding 1: a round court without an owner takes no command and offers taking over", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    await a.log.openSession(SESSION_A, ROUND);
    const court = await a.controller(SESSION_A);

    expect(blockedOf(a, court)).toEqual({ kind: "unowned", unsentPoints: 0 });
    expect(
      await startCourtMatch({ courtSessionId: SESSION_A, ...a }, SAMPLE_MATCH_ONE_SET),
    ).toMatchObject({
      ok: false,
    });
    expect((await a.load(SESSION_A)).events).toEqual([]);
  });

  test("finding 2: before the account is read, nothing is drawn and no command is taken", async () => {
    const server = createFakeCourtStreamServer();
    const a = await createPhone(1, server);
    const court = await openAndScore(a, SESSION_A, 1);

    a.account.switchTo(null);
    await court.reload();

    expect(blockedOf(a, court)).toEqual({ kind: "account-pending" });
    expect((await court.dispatch({ type: "score-point", team: "a" })).ok).toBe(false);
    a.account.switchTo(a.owner);
    await court.reload();
    expect(blockedOf(a, court)).toBeNull();
  });
});
