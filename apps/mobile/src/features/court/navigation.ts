import type { Href } from "expo-router";

import type { CourtSessionOrigin } from "./ports/court-event-log";

export const COURT_PATHS = {
  court: "/court/[courtSessionId]",
  setEnd: "/court/[courtSessionId]/set-end",
  matchEnd: "/court/[courtSessionId]/match-end",
  menu: "/court/[courtSessionId]/menu",
  corrections: "/court/[courtSessionId]/corrections",
  substitution: "/court/[courtSessionId]/substitution",
  lineup: "/court/[courtSessionId]/lineup",
} as const;

export type CourtPathKey = keyof typeof COURT_PATHS;

/** The theme is not on the route: it is the preference of the phone (E4.10, D9). */
export interface CourtRouteParams {
  readonly courtSessionId: string;
}

export function courtHref(path: CourtPathKey, { courtSessionId }: CourtRouteParams): Href {
  return { pathname: COURT_PATHS[path], params: { courtSessionId } };
}

/** Screen 09a of the court of a round (E4.11, D5): from the 06, the 08 and "Assumir de volta". */
export function takeOverHref({ groupId, roundId }: CourtSessionOrigin): Href {
  return { pathname: "/groups/[groupId]/rounds/[roundId]/take-over", params: { groupId, roundId } };
}
