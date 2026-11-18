import type { Href } from "expo-router";

export const COURT_PATHS = {
  court: "/court/[courtSessionId]",
  setEnd: "/court/[courtSessionId]/set-end",
  matchEnd: "/court/[courtSessionId]/match-end",
  menu: "/court/[courtSessionId]/menu",
  corrections: "/court/[courtSessionId]/corrections",
  substitution: "/court/[courtSessionId]/substitution",
} as const;

export type CourtPathKey = keyof typeof COURT_PATHS;

/** The theme is not on the route: it is the preference of the phone (E4.10, D9). */
export interface CourtRouteParams {
  readonly courtSessionId: string;
}

export function courtHref(path: CourtPathKey, { courtSessionId }: CourtRouteParams): Href {
  return { pathname: COURT_PATHS[path], params: { courtSessionId } };
}
