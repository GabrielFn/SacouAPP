import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { PlayerChipView } from "../model/draw-view";
import { ChipLockIcon } from "./DrawIcons";

export interface PlayerChipProps {
  readonly chip: PlayerChipView;
  readonly disabled: boolean;
  readonly onPress: (memberId: string) => void;
}

/**
 * A name of screen 07 with its level (Sorteio.dc.html .p): sand, navy when locked, outlined in blue when
 * selected. At least 44 high; a long name wraps instead of being cut.
 */
export function PlayerChip({ chip, disabled, onPress }: PlayerChipProps) {
  const { colors, tokens } = useTheme();
  const ground = chip.selected
    ? colors.selectFill
    : chip.locked
      ? colors.panelSurface
      : colors.background;
  const foreground = chip.locked && !chip.selected ? colors.onPanel : colors.text;
  const muted = chip.locked && !chip.selected ? colors.onPanel : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chip.accessibilityLabel}
      accessibilityState={{ selected: chip.selected, disabled }}
      disabled={disabled}
      onPress={() => {
        onPress(chip.memberId);
      }}
      style={{
        flex: 1,
        minHeight: tokens.sizes.minTouchTarget,
        borderRadius: tokens.radii.playerChip,
        backgroundColor: ground,
        borderWidth: chip.selected ? tokens.borderWidths.thick : undefined,
        borderColor: colors.selectOutline,
        paddingHorizontal: tokens.spacing.s,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs, flexShrink: 1 }}>
        {chip.locked ? (
          <ChipLockIcon color={chip.selected ? colors.text : colors.panelAccent} />
        ) : null}
        <Text variant="bodyStrong" style={{ color: foreground, flexShrink: 1 }}>
          {chip.label}
        </Text>
      </View>
      <Text variant="caption" tabular style={{ color: muted }}>
        {chip.level}
      </Text>
    </Pressable>
  );
}
