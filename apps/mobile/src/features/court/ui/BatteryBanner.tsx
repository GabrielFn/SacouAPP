import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { PERCENT_BASE } from "../court.data";

export interface BatteryBannerProps {
  /** The level that opened the warning, from 0 to 1. */
  readonly level: number;
  readonly onDismiss: () => void;
}

/** Takes the place of the queue strip until "Entendi" or the charger. It is an alert for the screen reader. */
export function BatteryBanner({ level, onDismiss }: BatteryBannerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing.l,
        borderTopWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.waitingFill,
        paddingHorizontal: tokens.spacing.l,
        paddingVertical: tokens.spacing.s,
      }}
    >
      <Text
        style={{
          flexShrink: 1,
          color: colors.text,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.small,
        }}
      >
        {strings.court.battery.warning(Math.round(level * PERCENT_BASE))}
      </Text>
      <Button label={strings.court.battery.dismiss} variant="secondary" onPress={onDismiss} />
    </View>
  );
}
