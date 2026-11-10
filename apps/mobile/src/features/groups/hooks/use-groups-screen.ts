import { useOnline } from "../../../services/api/use-online";
import { wallClockNow } from "../../../services/api/wall-clock";
import { offlineBannerText } from "../../../services/query/staleness";
import { groupsViewState, type GroupsViewState } from "../model/groups-view-state";
import { useMyGroups } from "../queries/use-group-queries";

export interface GroupsScreenModel {
  readonly state: GroupsViewState;
  /** The offline strip text ("Sem conexão · atualizado há 2 h") over kept data, else null. */
  readonly bannerText: string | null;
  readonly retry: () => void;
}

/** Everything the home and the groups list read from the query, derived on each render. */
export function useGroupsScreen(): GroupsScreenModel {
  const query = useMyGroups();
  const online = useOnline();
  return {
    state: groupsViewState(query),
    bannerText: offlineBannerText({
      online,
      dataUpdatedAt: query.dataUpdatedAt,
      now: wallClockNow(),
    }),
    retry: () => {
      void query.refetch();
    },
  };
}
