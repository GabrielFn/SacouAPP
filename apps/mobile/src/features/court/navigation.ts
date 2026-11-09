import type { Href } from "expo-router";

import type { ThemeName } from "../../theme/themes";

/** The two looks of the court, chosen on the route until the menu keeps a preference (E4.10). */
export type CourtThemeChoice = "sun" | "night";

export const COURT_THEME_PARAM = "theme";

export const COURT_PATHS = {
  court: "/court/[courtSessionId]",
  setEnd: "/court/[courtSessionId]/set-end",
  matchEnd: "/court/[courtSessionId]/match-end",
  menu: "/court/[courtSessionId]/menu",
  corrections: "/court/[courtSessionId]/corrections",
} as const;

export type CourtPathKey = keyof typeof COURT_PATHS;

export interface CourtRouteParams {
  readonly courtSessionId: string;
  readonly theme: CourtThemeChoice;
}

export function courtHref(path: CourtPathKey, { courtSessionId, theme }: CourtRouteParams): Href {
  return {
    pathname: COURT_PATHS[path],
    params: { courtSessionId, [COURT_THEME_PARAM]: theme },
  };
}

/** Anything that is not "night" is the sun theme, including a missing or mangled parameter. */
export function parseCourtTheme(value: string | string[] | undefined): CourtThemeChoice {
  return value === "night" ? "night" : "sun";
}

export function themeNameOf(choice: CourtThemeChoice): ThemeName {
  return choice === "night" ? "courtNight" : "courtSun";
}
