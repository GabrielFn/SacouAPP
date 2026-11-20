import { useQuery } from "@tanstack/react-query";

import { useOnline } from "../../../services/api/use-online";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { summaryView, type SummaryView } from "../model/summary-view";
import { roundSummaryQuery } from "../queries/summary-queries";
import { useUnsentPoints } from "./use-unsent-points";

export interface RoundSummaryModel {
  readonly view: SummaryView;
  readonly retry: () => void;
}

/** The summary query, the names of the group and the unsent points joined into the view of screen 12. */
export function useRoundSummary(groupId: string, roundId: string): RoundSummaryModel {
  const { sacouApi } = useServices();
  const summary = useQuery(roundSummaryQuery(sacouApi, groupId, roundId));
  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const online = useOnline();
  const unsentPoints = useUnsentPoints(roundId);
  return {
    view: summaryView({
      query: { status: summary.status, data: summary.data, error: summary.error },
      groupName: group.data?.name ?? null,
      members: members.data,
      online,
      unsentPoints,
    }),
    retry: () => void summary.refetch(),
  };
}
