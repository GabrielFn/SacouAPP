import type { ThemeName } from "../../../theme/themes";
import type { CourtThemeChoice } from "../ports/court-theme-preference";

export function themeNameOf(choice: CourtThemeChoice): ThemeName {
  return choice === "night" ? "courtNight" : "courtSun";
}
