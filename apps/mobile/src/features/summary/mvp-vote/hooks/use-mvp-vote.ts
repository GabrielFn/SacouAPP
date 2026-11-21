import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer } from "react";

import { useOnline } from "../../../../services/api/use-online";
import { wallClockNow } from "../../../../services/api/wall-clock";
import { useServices } from "../../../../services/services-context";
import { useGroup, useGroupMembers } from "../../../groups/queries/use-group-queries";
import { useMinuteTick } from "../../hooks/use-minute-tick";
import { headerLine } from "../../model/summary-texts";
import { roundSummaryQuery } from "../../queries/summary-queries";
import { mvpVoteView, type MvpVoteView } from "../model/mvp-vote-view";
import { INITIAL_MVP_VOTE, mvpVoteReducer } from "../model/mvp-vote.reducer";
import {
  createVoteSubmitter,
  mvpVotingQuery,
  nextBallotChangeAt,
  scheduleBallotRefresh,
} from "../queries/mvp-vote-queries";

export interface MvpVoteModel {
  /** "Racha de terça · 6 partidas"; only the group name until the summary is read. */
  readonly header: string;
  readonly view: MvpVoteView;
  readonly select: (memberId: string) => void;
  readonly submit: () => void;
  readonly retry: () => void;
  readonly dismissError: () => void;
}

/**
 * Screen 12a: the ballot from the cache, the choice in the reducer, the network, and the sending. The
 * reducer never holds the vote that went: the answer goes into the cache. Nothing here logs an ID.
 */
export function useMvpVote(groupId: string, roundId: string): MvpVoteModel {
  const { sacouApi, scheduler } = useServices();
  const client = useQueryClient();
  const ballot = useQuery(mvpVotingQuery(sacouApi, groupId, roundId));
  const summary = useQuery(roundSummaryQuery(sacouApi, groupId, roundId));
  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const online = useOnline();
  const nowMs = useMinuteTick(scheduler, ballot.data?.state === "open");
  const [vote, send] = useReducer(mvpVoteReducer, INITIAL_MVP_VOTE);
  const submitter = useMemo(
    () => createVoteSubmitter({ api: sacouApi, client }, { groupId, roundId }),
    [sacouApi, client, groupId, roundId],
  );
  const changeAt = nextBallotChangeAt(ballot.data);
  useEffect(
    () => scheduleBallotRefresh(scheduler, client, { groupId, roundId }, changeAt, wallClockNow()),
    [scheduler, client, groupId, roundId, changeAt],
  );

  const view = mvpVoteView({
    query: { status: ballot.status, data: ballot.data, error: ballot.error },
    members: members.data,
    online,
    nowMs,
    vote,
  });
  const groupName = group.data?.name ?? null;
  const header =
    summary.data === undefined
      ? (groupName ?? "")
      : headerLine(groupName, summary.data.finishedMatches);

  return {
    header,
    view,
    select: (memberId) => {
      send({ type: "candidate-selected", memberId });
    },
    submit: () => {
      const candidate = vote.selected;
      if (candidate === null || view.body.kind !== "choosing" || !view.body.canSubmit) return;
      const sending = submitter.submit(candidate);
      if (sending === null) return;
      send({ type: "submit-requested" });
      void sending.then((result) => {
        send(
          result.ok ? { type: "submit-succeeded" } : { type: "submit-failed", error: result.error },
        );
      });
    },
    dismissError: () => {
      send({ type: "error-dismissed" });
    },
    retry: () => void ballot.refetch(),
  };
}
