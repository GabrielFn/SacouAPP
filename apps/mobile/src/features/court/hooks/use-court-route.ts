import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";

import {
  courtHref,
  parseCourtTheme,
  type CourtPathKey,
  type CourtRouteParams,
} from "../navigation";

export interface CourtRouteNavigation {
  readonly params: CourtRouteParams;
  readonly push: (path: CourtPathKey) => void;
  readonly replace: (path: CourtPathKey) => void;
  readonly back: () => void;
  /** Back when there is somewhere to go back to, the court itself otherwise (a cold start on this route). */
  readonly backOrCourt: () => void;
  readonly leave: () => void;
}

/** The session and the theme come from the route; the court never keeps a copy of either. */
export function useCourtRoute(): CourtRouteNavigation {
  const router = useRouter();
  const search = useLocalSearchParams<{ courtSessionId: string; theme?: string }>();
  const params = useMemo<CourtRouteParams>(
    () => ({ courtSessionId: search.courtSessionId, theme: parseCourtTheme(search.theme) }),
    [search.courtSessionId, search.theme],
  );
  const push = useCallback(
    (path: CourtPathKey) => {
      router.push(courtHref(path, params));
    },
    [router, params],
  );
  const replace = useCallback(
    (path: CourtPathKey) => {
      router.replace(courtHref(path, params));
    },
    [router, params],
  );
  const back = useCallback(() => {
    router.back();
  }, [router]);
  const backOrCourt = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(courtHref("court", params));
    }
  }, [router, params]);
  const leave = useCallback(() => {
    router.dismissTo("/");
  }, [router]);
  return { params, push, replace, back, backOrCourt, leave };
}
