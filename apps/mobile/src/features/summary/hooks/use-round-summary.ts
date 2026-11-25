import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useFeatureOn } from "../../app-config/hooks/use-app-config";
import { useOnline } from "../../../services/api/use-online";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { mvpVotingQuery, nextBallotChangeAt } from "../mvp-vote/queries/mvp-vote-queries";
import { summaryShareText } from "../model/summary-share-text";
import { summaryView, type SummaryView } from "../model/summary-view";
import { roundSummaryQuery, scheduleSummaryRefresh } from "../queries/summary-queries";
import { useMinuteTick } from "./use-minute-tick";
import { useUnsentPoints } from "./use-unsent-points";

export interface RoundSummaryModel {
  readonly view: SummaryView;
  readonly retry: () => void;
  /** Hands the text of the summary to the share sheet; does nothing unless the summary is ready. */
  readonly share: () => void;
}

/**
 * The summary query, the ballot (only while the voting is open), the names of the group and the unsent
 * points joined into the view of screen 12. Nothing about the vote is stored here.
 */
export function useRoundSummary(groupId: string, roundId: string): RoundSummaryModel {
  const { sacouApi, shareSheet, scheduler } = useServices();
  const client = useQueryClient();
  const summary = useQuery(roundSummaryQuery(sacouApi, groupId, roundId));
  const mvpVoteOn = useFeatureOn("mvpVote");
  const voting = mvpVoteOn ? (summary.data?.mvpVoting ?? null) : null;
  const ballot = useQuery({
    ...mvpVotingQuery(sacouApi, groupId, roundId),
    enabled: voting?.state === "open",
  });
  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const online = useOnline();
  const unsentPoints = useUnsentPoints(roundId);
  const nowMs = useMinuteTick(scheduler, voting?.state === "open");
  const changeAt = nextBallotChangeAt(voting);
  useEffect(
    () => scheduleSummaryRefresh(scheduler, client, { groupId, roundId }, changeAt, wallClockNow()),
    [scheduler, client, groupId, roundId, changeAt],
  );
  const view = summaryView({
    query: { status: summary.status, data: summary.data, error: summary.error },
    groupName: group.data?.name ?? null,
    members: members.data,
    online,
    unsentPoints,
    ballot: voting?.state === "open" ? ballot.data : undefined,
    mvpVoteOn,
    nowMs,
  });
  return {
    view,
    retry: () => void summary.refetch(),
    share: () => {
      if (view.kind === "ready")
        void shareSheet.share(summaryShareText(view)).catch(() => undefined);
    },
  };
}
