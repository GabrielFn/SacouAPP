import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { ChevronRightIcon } from "../../../ui/Icons";
import type { Theme } from "../../../theme/themes";
import { Text } from "../../../ui/Text";

export interface MenuRowProps {
  readonly label: string;
  /** The icon before the label, drawn in the color it receives. */
  readonly renderIcon: (color: string) => ReactNode;
  readonly hint?: string;
  readonly accessibilityLabel?: string;
  readonly chevron?: boolean;
  readonly disabled?: boolean;
  /** The color of a refusal, for what closes the whole night (screen 23, "Encerrar rodada"). */
  readonly danger?: boolean;
  readonly onPress: () => void;
}

function inkOf(colors: Theme, disabled: boolean, danger: boolean): string {
  if (disabled) return colors.textMuted;
  return danger ? colors.refusal : colors.text;
}

function spokenLabel(label: string, hint: string | undefined, custom: string | undefined): string {
  if (custom !== undefined) return custom;
  return hint === undefined ? label : strings.court.menu.hintLabel(label, hint);
}

export interface RowHintProps {
  readonly hint: string;
  /** Set only on the row of a refusal, where the hint takes the color of the label. */
  readonly ink: string | null;
}

function RowHint({ hint, ink }: RowHintProps) {
  return (
    <Text variant="muted" style={ink === null ? undefined : { color: ink }}>
      {strings.court.menu.hintAfter(hint)}
    </Text>
  );
}

export function MenuRow({
  label,
  renderIcon,
  hint,
  accessibilityLabel,
  chevron = false,
  disabled = false,
  danger = false,
  onPress,
}: MenuRowProps) {
  const { colors, tokens } = useTheme();
  const ink = inkOf(colors, disabled, danger);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      accessibilityLabel={spokenLabel(label, hint, accessibilityLabel)}
      onPress={onPress}
      style={{
        minHeight: tokens.sheet.sizes.menuRow,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s14,
        paddingHorizontal: tokens.spacing.xs,
      }}
    >
      {renderIcon(ink)}
      <Text
        variant="title"
        style={{
          flexShrink: 1,
          fontFamily: fontFamilies.body600,
          color: ink,
        }}
      >
        {label}
        {hint === undefined ? null : <RowHint hint={hint} ink={danger ? ink : null} />}
      </Text>
      {chevron ? (
        <View style={{ marginLeft: "auto" }}>
          <ChevronRightIcon color={colors.textMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}
