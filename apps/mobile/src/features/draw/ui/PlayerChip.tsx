import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import type { Theme } from "../../../theme/themes";
import { Text } from "../../../ui/Text";
import type { PlayerChipView } from "../model/draw-view";
import { ChipLockIcon } from "./DrawIcons";

interface ChipLook {
  readonly ground: string;
  readonly foreground: string;
  readonly muted: string;
  readonly lock: string;
}

/** Selected wins over locked: the pale blue with navy text; locked alone is navy with sand text. */
function chipLook(chip: PlayerChipView, colors: Theme): ChipLook {
  if (chip.selected) {
    return {
      ground: colors.selectFill,
      foreground: colors.text,
      muted: colors.textMuted,
      lock: colors.text,
    };
  }
  if (chip.locked) {
    return {
      ground: colors.panelSurface,
      foreground: colors.onPanel,
      muted: colors.onPanel,
      lock: colors.panelAccent,
    };
  }
  return {
    ground: colors.background,
    foreground: colors.text,
    muted: colors.textMuted,
    lock: colors.text,
  };
}

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
  const look = chipLook(chip, colors);
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
        backgroundColor: look.ground,
        borderWidth: chip.selected ? tokens.borderWidths.thick : undefined,
        borderColor: colors.selectOutline,
        paddingHorizontal: tokens.spacing.s,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          flexShrink: 1,
        }}
      >
        {chip.locked ? <ChipLockIcon color={look.lock} /> : null}
        <Text variant="bodyStrong" style={{ color: look.foreground, flexShrink: 1 }}>
          {chip.label}
        </Text>
      </View>
      <Text variant="caption" tabular style={{ color: look.muted }}>
        {chip.level}
      </Text>
    </Pressable>
  );
}
