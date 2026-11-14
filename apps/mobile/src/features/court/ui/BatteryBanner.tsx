import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { accessibilityFloors, fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { PERCENT_BASE } from "../court.data";
import { bottomStripWeight } from "../model/bottom-strip-weight";
import type { CourtLayout } from "../model/court-layout";

export interface BatteryBannerProps {
  readonly layout: CourtLayout;
  /** The level that opened the warning, from 0 to 1. */
  readonly level: number;
  readonly onDismiss: () => void;
}

/**
 * Takes the place of the queue strip (same weight, so the court does not move) until "Entendi" or
 * the charger. It is an alert for the screen reader, announced at once.
 */
export function BatteryBanner({ layout, level, onDismiss }: BatteryBannerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        flex: bottomStripWeight(layout),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing.l,
        borderTopWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.waitingFill,
        paddingHorizontal: tokens.spacing.l,
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex: 1,
          color: colors.text,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.small,
        }}
      >
        {strings.court.battery.warning(Math.round(level * PERCENT_BASE))}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.court.battery.dismiss}
        onPress={onDismiss}
        style={{
          alignItems: "center",
          justifyContent: "center",
          minHeight: accessibilityFloors.touchTarget,
          minWidth: accessibilityFloors.touchTarget,
          borderRadius: tokens.radii.button,
          paddingHorizontal: tokens.spacing.l,
          backgroundColor: colors.text,
        }}
      >
        <Text
          style={{
            color: colors.background,
            fontFamily: fontFamilies.body700,
            fontSize: tokens.fontSizes.small,
          }}
        >
          {strings.court.battery.dismiss}
        </Text>
      </Pressable>
    </View>
  );
}
