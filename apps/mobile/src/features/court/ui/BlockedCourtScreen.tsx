import { useRouter } from "expo-router";

import { useCourtSessionOrigin } from "../../../services/query/use-court-session-origin";
import { useGroupMembers } from "../../groups/queries/use-group-queries";
import { useCourtRuntime } from "../hooks/court-runtime-context";
import { useCourtSummaryLookup } from "../hooks/use-court-summary-lookup";
import { takeOverHref } from "../navigation";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { findSessionOrigin } from "../session/individual-points";
import type { BlockedCourt } from "../takeover/blocked-court";
import type { RefusedPointsModel } from "../takeover/refused-points-model";
import {
  backdropOf,
  refusedTexts,
  takenOverTexts,
  writerNameOf,
  type BackdropScore,
} from "../takeover/takeover-texts";
import { CourtBlockedView } from "./CourtBlockedView";
import { RefusedPointsSheet } from "./RefusedPointsSheet";
import { TakenOverBanner } from "./TakenOverBanner";

export interface BlockedCourtScreenProps {
  readonly block: BlockedCourt;
  readonly courtSessionId: string;
  /** The score of the log of this phone: the backdrop without a summary (D7). */
  readonly localScore: BackdropScore | null;
  readonly onLeave: () => void;
  readonly onRefusedSeen: () => void;
}

export interface TakenOverScreenProps {
  readonly origin: CourtSessionOrigin | null;
  readonly refused: RefusedPointsModel | null;
  readonly localScore: BackdropScore | null;
  readonly onLeave: () => void;
  readonly onTakeBack: (() => void) | null;
  readonly onRefusedSeen: () => void;
}

/**
 * 09c while its points were not seen, then 09b. The summary says who took over, when, and the score;
 * without it (offline) the texts have no name and the score is the one of this phone.
 */
function TakenOverScreen({
  origin,
  refused,
  localScore,
  onLeave,
  onTakeBack,
  onRefusedSeen,
}: TakenOverScreenProps) {
  const summary = useCourtSummaryLookup(origin, true);
  const members = useGroupMembers(origin?.groupId ?? "", origin !== null).data;
  const found = summary.lookup?.status === "found" ? summary.lookup.summary : null;
  const writerName = writerNameOf(found, members);
  const backdrop = (found === null ? null : backdropOf(found)) ?? localScore;
  if (refused === null) {
    return (
      <TakenOverBanner
        texts={takenOverTexts(found, writerName)}
        backdrop={backdrop}
        onLeave={onLeave}
        onTakeBack={onTakeBack}
      />
    );
  }
  return (
    <RefusedPointsSheet
      texts={refusedTexts(refused.rows.length, refused.otherPhoneFirst, found, writerName)}
      model={refused}
      backdrop={backdrop}
      onUnderstood={onRefusedSeen}
    />
  );
}

/**
 * The court without its gestures: 09c and 09b when another phone took it over, the court of another
 * account or of none, and nothing at all while the account is read. "Assumir" opens the 09a of the
 * round of the session.
 */
export function BlockedCourtScreen({
  block,
  courtSessionId,
  localScore,
  onLeave,
  onRefusedSeen,
}: BlockedCourtScreenProps) {
  const { log } = useCourtRuntime();
  const router = useRouter();
  const origin =
    useCourtSessionOrigin(courtSessionId, () => findSessionOrigin(log, courtSessionId)) ?? null;
  const takeOver =
    origin === null
      ? null
      : () => {
          router.push(takeOverHref(origin));
        };
  switch (block.kind) {
    case "account-pending":
      return null;
    case "taken-over":
      return (
        <TakenOverScreen
          origin={origin}
          refused={block.refused}
          localScore={localScore}
          onLeave={onLeave}
          onTakeBack={takeOver}
          onRefusedSeen={onRefusedSeen}
        />
      );
    case "other-account":
    case "unowned":
      return (
        <CourtBlockedView
          kind={block.kind}
          unsentPoints={block.unsentPoints}
          onLeave={onLeave}
          onTakeOver={takeOver}
        />
      );
  }
}
