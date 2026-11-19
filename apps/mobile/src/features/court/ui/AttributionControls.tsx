import type { MemberId } from "@sacou/match-engine";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { courtPalette, fontFamilies, palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { AuthorOption } from "../attribution/attribution-selectors";

/** The sheet is always the light one of the prototype (PontoIndividual.dc.html), in both themes. */
export const SHEET = {
  ground: palette.sand,
  ink: palette.black,
  muted: courtPalette.sun.muted,
  refusal: courtPalette.sun.refusal,
  onInk: palette.white,
} as const;
/** Three players a line, four kinds a line, as the canvas lays them out. */
export const PLAYER_COLUMNS = 3;
export const KIND_COLUMNS = 4;

export interface AuthorButtonProps {
  readonly option: AuthorOption;
  readonly onPress: (memberId: MemberId) => void;
}

export function AuthorButton({ option, onPress }: AuthorButtonProps) {
  const { tokens } = useTheme();
  const color = option.enabled ? SHEET.ink : SHEET.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option.accessibilityLabel}
      accessibilityState={{ disabled: !option.enabled }}
      disabled={!option.enabled}
      onPress={() => {
        onPress(option.memberId);
      }}
      style={{
        height: tokens.sheet.sizes.playerCard,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs,
        paddingHorizontal: tokens.spacing.xs,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thick,
        borderColor: color,
        borderStyle: option.enabled ? "solid" : "dashed",
        backgroundColor: palette.white,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.button,
        }}
      >
        {option.name}
      </Text>
      {option.detail === null ? null : (
        <Text variant="caption" numberOfLines={1} style={{ color: SHEET.muted }}>
          {option.detail}
        </Text>
      )}
      {option.badge === null ? null : (
        <View
          style={{
            position: "absolute",
            top: tokens.spacing.s6,
            right: tokens.spacing.s6,
            minWidth: tokens.sheet.sizes.authorBadge,
            height: tokens.sheet.sizes.authorBadge,
            borderRadius: tokens.sheet.sizes.authorBadge,
            paddingHorizontal: tokens.spacing.xs,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: SHEET.ink,
          }}
        >
          <Text
            style={{
              color: SHEET.onInk,
              fontFamily: fontFamilies.body700,
              fontSize: tokens.sheet.fontSizes.authorBadge,
            }}
          >
            {option.badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export interface KindChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

export function KindChip({ label, selected, disabled, onPress }: KindChipProps) {
  const { tokens } = useTheme();
  const color = disabled ? SHEET.muted : SHEET.ink;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: tokens.sizes.chip,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.borderWidths.thick,
        borderColor: color,
        borderStyle: disabled ? "dashed" : "solid",
        backgroundColor: selected ? SHEET.ink : palette.white,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? SHEET.onInk : color,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.body,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface GridProps {
  readonly columns: number;
  readonly children: ReactNode[];
}

/** Rows of equal columns: a short last row keeps the width of its cells. */
export function Grid({ columns, children }: GridProps) {
  const { tokens } = useTheme();
  const rows = Array.from({ length: Math.ceil(children.length / columns) }, (_, row) =>
    Array.from({ length: columns }, (_cell, column) => children[row * columns + column] ?? null),
  );
  return (
    <View style={{ gap: tokens.spacing.s }}>
      {rows.map((cells, row) => (
        <View key={row} style={{ flexDirection: "row", gap: tokens.spacing.s }}>
          {cells.map((cell, column) => (
            <View key={column} style={{ flex: 1 }}>
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export interface FullButtonProps {
  readonly label: string;
  readonly filled: boolean;
  readonly onPress: () => void;
  readonly icon?: ReactNode;
}

/** The two 56 high buttons of the sheet: "Pular" black, "Erro do <time>" dashed. */
export function FullButton({ label, filled, onPress, icon }: FullButtonProps) {
  const { tokens } = useTheme();
  const color = filled ? SHEET.onInk : SHEET.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: tokens.sizes.primaryButton,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.s,
        borderRadius: tokens.radii.button,
        borderWidth: filled ? 0 : tokens.borderWidths.thick,
        borderStyle: "dashed",
        borderColor: SHEET.ink,
        backgroundColor: filled ? SHEET.ink : "transparent",
      }}
    >
      {icon}
      <Text style={{ color, fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.button }}>
        {label}
      </Text>
    </Pressable>
  );
}
