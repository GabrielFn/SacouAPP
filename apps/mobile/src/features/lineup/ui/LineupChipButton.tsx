import { Pressable, View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { Theme } from "../../../theme/themes";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { BallIcon } from "../../court/ui/CourtIcons";
import type { LineupChip } from "../model/lineup-court";

const HALF = 2;
const NO_BORDER = 0;

export interface LineupChipButtonProps {
  readonly chip: LineupChip;
  readonly onPress: (memberId: string) => void;
}

interface ChipColors {
  readonly fill: string;
  readonly ink: string;
  readonly border: string;
}

/** White chip, yellow for the server, inverted for the libero (pergunta 14), pale blue when picked. */
function chipColors(chip: LineupChip, colors: Theme): ChipColors {
  if (chip.isSelected)
    return { fill: colors.selectFill, ink: colors.text, border: colors.selectOutline };
  if (chip.isLibero) return { fill: colors.text, ink: colors.surface, border: colors.text };
  return {
    fill: chip.isServer ? colors.accent : colors.surface,
    ink: colors.text,
    border: colors.text,
  };
}

export interface ChipBadgeProps {
  readonly label: string;
  readonly side: "left" | "right";
  readonly warning: boolean;
}

/** "L" of the setter at the top right, "!" of a misplaced member at the top left (Escalacao.dc.html .st, .wn). */
function ChipBadge({ label, side, warning }: ChipBadgeProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.sizes.lineupBadge;
  const edge = -tokens.court.spacing.badgeOffsetX;
  return (
    <View
      style={{
        position: "absolute",
        top: -tokens.court.spacing.badgeOffsetY,
        [side]: edge,
        minWidth: size,
        height: size,
        paddingHorizontal: tokens.spacing.xs / HALF,
        borderRadius: size,
        borderWidth: warning ? tokens.borderWidths.thick : NO_BORDER,
        borderColor: colors.text,
        backgroundColor: warning ? colors.accent : colors.text,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: warning ? colors.text : colors.surface,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.court.fontSizes.badge,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** One member on the half court of screen 22: a pill with the name and the position (D2). */
export function LineupChipButton({ chip, onPress }: LineupChipButtonProps) {
  const { colors, tokens } = useTheme();
  const { fill, ink, border } = chipColors(chip, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chip.accessibilityLabel}
      accessibilityState={{ selected: chip.isSelected, disabled: chip.isLibero }}
      disabled={chip.isLibero}
      onPress={() => {
        onPress(chip.memberId);
      }}
      style={{
        maxWidth: "100%",
        minHeight: tokens.sizes.chip,
        paddingHorizontal: tokens.spacing.m,
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.court.borderWidths.outline,
        borderColor: border,
        backgroundColor: fill,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.xs,
      }}
    >
      {chip.isServer ? <BallIcon /> : null}
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, color: ink, fontFamily: fontFamilies.body700 }}
      >
        {chip.name}
      </Text>
      <Text tabular variant="caption" style={{ color: ink }}>
        {chip.slot}
      </Text>
      {chip.isSetter ? (
        <ChipBadge label={texts.badges.setter} side="right" warning={false} />
      ) : null}
      {chip.isLibero ? (
        <ChipBadge label={texts.badges.libero} side="right" warning={false} />
      ) : null}
      {chip.isMisplaced ? <ChipBadge label={texts.badges.misplaced} side="left" warning /> : null}
    </Pressable>
  );
}
