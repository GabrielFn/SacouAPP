import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { dayStripSwatches } from "../../../theme/themes";
import { dayStripBasis } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { swatchIndexOf, type DayStripText } from "../../rounds/model/round-cards";

export interface DayStripProps {
  /** The day and hour of the next round, or `null` for the neutral "no round" strip. */
  readonly strip: DayStripText | null;
  readonly groupId: string;
}

/**
 * The strip of the day on the left of a card: the group's own color with the day and hour of its next
 * round, or the neutral ground and a dash without one (the Pelada do Sesc card of Grupos.dc.html).
 */
export function DayStrip({ strip, groupId }: DayStripProps) {
  const { colors, tokens } = useTheme();
  const swatch =
    strip === null ? undefined : dayStripSwatches[swatchIndexOf(groupId, dayStripSwatches.length)];
  const textColor = swatch?.text ?? colors.text;
  return (
    <View
      accessible
      accessibilityLabel={
        strip === null
          ? strings.groups.card.noRoundStrip
          : strings.rounds.cards.stripLabel(strip.day, strip.hour)
      }
      style={{
        flexBasis: dayStripBasis,
        flexGrow: 0,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: swatch?.fill ?? colors.background,
        borderRightWidth: swatch === undefined ? tokens.borderWidths.thin : undefined,
        borderRightColor: colors.borderCard,
      }}
    >
      {strip === null ? (
        <Text variant="display" displaySize="displayMedium">
          {strings.groups.card.noRoundDash}
        </Text>
      ) : (
        <>
          <Text variant="display" style={{ color: textColor }}>
            {strip.day}
          </Text>
          <Text
            variant="display"
            displaySize="displayMedium"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: textColor }}
          >
            {strip.hour}
          </Text>
        </>
      )}
    </View>
  );
}
