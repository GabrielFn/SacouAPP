import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { dayStripBasis } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

/**
 * The strip of the day on the left of a card. Only the "no round" variant exists until E3.4 brings
 * rounds (neutral ground and a dash, as the Pelada do Sesc card of Grupos.dc.html).
 */
export function DayStrip() {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={strings.groups.card.noRoundStrip}
      style={{
        flexBasis: dayStripBasis,
        flexGrow: 0,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        borderRightWidth: tokens.borderWidths.thin,
        borderRightColor: colors.borderCard,
      }}
    >
      <Text variant="display" displaySize="displayMedium">
        {strings.groups.card.noRoundDash}
      </Text>
    </View>
  );
}
