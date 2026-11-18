import type { CourtSessionTimeline, EventEnvelope } from "@sacou/match-engine";

import { stateOfTimeline } from "../model/court-screen.selectors";

import type { CourtReplayer } from "../session/court-replay";
import type { CourtSyncStanding } from "../session/court-session-controller";
import type { WriteContext } from "../session/court-session-loader";
import { countPoints, pendingEvents } from "../sync/pending-events";
import type { SyncNotice } from "../sync/sync-notice";
import { refusedPointsModel, showsRefused, type RefusedPointsModel } from "./refused-points-model";
import type { BackdropScore } from "./takeover-texts";

/**
 * The court that takes no gesture, derived from the file each time (frontend.md, rule 1):
 * - `account-pending`: whose it is is not known yet, nothing is drawn;
 * - `taken-over`: screen 09b, with the 09c over it while its refused points were not seen (D6, B8);
 * - `other-account` and `unowned`: only "Sair da quadra" and "Assumir a quadra", which says first how
 *   many points of this phone were never sent and are left out by taking it over (S4).
 */
export type BlockedCourt =
  | { readonly kind: "account-pending" }
  | { readonly kind: "taken-over"; readonly refused: RefusedPointsModel | null }
  | { readonly kind: "other-account" | "unowned"; readonly unsentPoints: number };

export interface BlockedCourtInput {
  readonly courtSessionId: string;
  readonly events: readonly EventEnvelope[];
  readonly sync: CourtSyncStanding;
  readonly writer: WriteContext;
}

function refusedOf(input: BlockedCourtInput, replayer: CourtReplayer): RefusedPointsModel | null {
  const { courtSessionId, events, sync, writer } = input;
  if (!sync.refusedUnseen) return null;
  const model = refusedPointsModel(courtSessionId, writer.deviceId, { events, ...sync }, replayer);
  return showsRefused(model, sync.refusedUnseen) ? model : null;
}

/** `null` while the court marks; the block otherwise, by the priority of `selectSyncNotice`. */
export function blockedCourtOf(
  input: BlockedCourtInput,
  notice: SyncNotice | null,
  replayer: CourtReplayer,
): BlockedCourt | null {
  switch (notice?.kind) {
    case undefined:
    case "stopped":
      return null;
    case "account-pending":
      return { kind: "account-pending" };
    case "taken-over":
      return { kind: "taken-over", refused: refusedOf(input, replayer) };
    case "other-account":
    case "unowned": {
      const pending = pendingEvents(input.events, { ...input.writer, ...input.sync });
      return { kind: notice.kind, unsentPoints: countPoints(pending) };
    }
  }
}

/** The score of the set on this phone: the backdrop of 09b and 09c when the summary is not there. */
export function localScoreOf(timeline: CourtSessionTimeline): BackdropScore | null {
  const score = stateOfTimeline(timeline).currentMatch?.currentSet?.score ?? null;
  return score === null ? null : { a: score.a, b: score.b };
}
