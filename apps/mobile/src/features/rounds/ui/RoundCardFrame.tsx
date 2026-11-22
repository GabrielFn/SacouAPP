import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { DayStrip } from "../../groups/ui/DayStrip";
import type { DayStripText } from "../model/round-cards";

export interface RoundCardFrameProps {
  readonly groupId: string;
  readonly strip: DayStripText;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

/** The touchable card of a round (Inicio.dc.html, Grupos.dc.html): the day strip on the left, the lines on the right. */
export function RoundCardFrame({
  groupId,
  strip,
  accessibilityLabel,
  onPress,
  children,
}: RoundCardFrameProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        flexDirection: "row",
        minHeight: tokens.sizes.groupCardMin,
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.card,
        overflow: "hidden",
      }}
    >
      <DayStrip strip={strip} groupId={groupId} />
      <View style={{ flex: 1, padding: tokens.spacing.m, gap: tokens.spacing.xs }}>{children}</View>
    </Pressable>
  );
}
