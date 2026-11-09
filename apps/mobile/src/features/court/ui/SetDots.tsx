import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES, type TeamColorName } from "../../../theme/team-colors";

export interface SetDotsProps {
  /** The color of whoever won each set, `null` for the set still open. */
  readonly sets: readonly (TeamColorName | null)[];
  readonly accessibilityLabel: string;
}

/** One dot per set played or in play, filled with the color of the winner. */
export function SetDots({ sets, accessibilityLabel }: SetDotsProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.setDot;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", gap: tokens.spacing.xs }}
    >
      {sets.map((winner, index) => (
        <View
          // The dots only ever grow at the end, so the position is the identity of a set.
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size,
            borderWidth: tokens.borderWidths.thick,
            borderColor: colors.text,
            backgroundColor: winner === null ? undefined : TEAM_PALETTES[winner].fill,
          }}
        />
      ))}
    </View>
  );
}
