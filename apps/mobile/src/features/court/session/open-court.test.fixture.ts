import type { MatchStartedPayload } from "@sacou/match-engine";

import {
  createFakeCourtEventLog,
  type FakeCourtEventLog,
} from "../../../adapters/fake-court-event-log";
import { signedInCourtSyncHooks } from "../../../adapters/fake-court-sync";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRuntime } from "../ports/court-runtime";
import type { CourtCommand } from "./command-drafts";
import { createCourtReplayer } from "./court-replay";
import { createCourtSessionController } from "./court-session-controller";
import { startCourtMatch } from "./start-court-match";

/** Fixtures of R97: a phone with a match left open in a round, by the steps the court takes. */
export const ACCOUNT_A = "key-a";
export const ACCOUNT_B = "key-b";
export const OLD_ROUND: CourtSessionOrigin = { groupId: "g1", roundId: "r-old" };
export const NEW_ROUND: CourtSessionOrigin = { groupId: "g1", roundId: "r-new" };
export const OLD_SESSION = "c0000000-0000-4000-8000-0000000000d1";

/** One point decides the set; best of three, so a confirmed set leaves the match without a set. */
export const ONE_POINT_SETS: MatchStartedPayload = {
  ...SAMPLE_MATCH_ONE_SET,
  scoring: { bestOf: 3, pointsPerSet: 1, tieBreakPoints: null, winMargin: 1 },
};

/** One point ends the set and the match. */
export const ONE_POINT_MATCH: MatchStartedPayload = {
  ...SAMPLE_MATCH_ONE_SET,
  scoring: { bestOf: 1, pointsPerSet: 1, tieBreakPoints: null, winMargin: 1 },
};

export interface SignedIn {
  key: string | null;
}

export interface TestCourt extends CourtRuntime {
  readonly log: FakeCourtEventLog;
  readonly appended: { count: number };
}

export function testCourt(account: SignedIn = { key: ACCOUNT_A }): TestCourt {
  const ids = createSequentialIdGenerator();
  const hooks = signedInCourtSyncHooks(account);
  const appended = { count: 0 };
  return {
    log: createFakeCourtEventLog(ids),
    replayer: createCourtReplayer(),
    ids,
    appended,
    sync: {
      ...hooks,
      notifyAppended: () => {
        appended.count += 1;
      },
    },
  };
}

/** Opens a session of `origin` (or a sample one with `null`) and starts `match` in it. */
export async function openWithMatch(
  court: CourtRuntime,
  origin: CourtSessionOrigin | null,
  match: MatchStartedPayload = ONE_POINT_SETS,
  ownerKey: string | null = ACCOUNT_A,
): Promise<void> {
  await court.log.openSession(OLD_SESSION, origin === null ? undefined : { ...origin, ownerKey });
  // Started as the owner did, whoever is signed in now.
  const { log, replayer, ids } = court;
  await startCourtMatch({ log, replayer, ids, courtSessionId: OLD_SESSION }, match);
}

/** Runs court commands in the open session, as the screens do. */
export async function play(court: CourtRuntime, commands: readonly CourtCommand[]): Promise<void> {
  const controller = createCourtSessionController({ ...court, courtSessionId: OLD_SESSION });
  for (const command of commands) await controller.dispatch(command);
}
