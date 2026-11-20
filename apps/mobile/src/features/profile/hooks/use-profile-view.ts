import { useQuery } from "@tanstack/react-query";

import { useOnline } from "../../../services/api/use-online";
import { useServices } from "../../../services/services-context";
import { myProfileQuery } from "../queries/profile-queries";
import { myStatsQuery } from "../queries/stats-queries";
import { profileView, type ProfileView } from "../model/profile-view";

export interface ProfileScreenModel {
  readonly view: ProfileView;
  readonly retry: () => void;
}

/** The two queries of the "Eu" tab and what they say together, derived on each render. */
export function useProfileView(): ProfileScreenModel {
  const { sacouApi } = useServices();
  const profile = useQuery(myProfileQuery(sacouApi, true));
  const stats = useQuery(myStatsQuery(sacouApi, true));
  const online = useOnline();
  return {
    view: profileView(profile, stats, online),
    retry: () => {
      void profile.refetch();
      void stats.refetch();
    },
  };
}
