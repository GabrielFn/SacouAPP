import { useOnline } from "../../../services/api/use-online";
import { wallClockNow } from "../../../services/api/wall-clock";
import { offlineBannerText } from "../../../services/query/staleness";
import { organizes } from "../../groups/model/groups-list.selectors";
import { useMyGroups } from "../../groups/queries/use-group-queries";
import { groupRoundsView, type GroupRoundsView } from "../model/group-rounds";
import { useRounds } from "../queries/use-round-queries";

export type GroupRoundsModel =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly retry: () => void }
  | {
      readonly kind: "list";
      readonly view: GroupRoundsView;
      readonly groupName: string;
      /** Only who organizes sees "Nova rodada"; unknown while the groups are loading. */
      readonly canCreate: boolean;
      /** "Sem conexão · atualizado há 2 h" over kept data, else null. */
      readonly bannerText: string | null;
    };

/**
 * The rounds of one group for the "Rodadas do grupo" screen. The list and the role are derived from the
 * query cache on each render (frontend.md, rule 1): nothing is copied into state, and there is no
 * reducer because the screen has no local state with transitions (it only reads and navigates).
 */
export function useGroupRounds(groupId: string): GroupRoundsModel {
  const rounds = useRounds(groupId);
  const groups = useMyGroups();
  const online = useOnline();
  if (rounds.data === undefined) {
    if (rounds.isError) {
      return {
        kind: "error",
        retry: () => {
          void rounds.refetch();
        },
      };
    }
    return { kind: "loading" };
  }
  const group = groups.data?.find((candidate) => candidate.groupId === groupId);
  return {
    kind: "list",
    view: groupRoundsView(groupId, rounds.data, wallClockNow()),
    groupName: group?.name ?? "",
    canCreate: group !== undefined && organizes(group.role),
    bannerText: offlineBannerText({
      online,
      dataUpdatedAt: rounds.dataUpdatedAt,
      now: wallClockNow(),
    }),
  };
}
