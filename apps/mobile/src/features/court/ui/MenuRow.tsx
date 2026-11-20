import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { ChevronRightIcon } from "../../../ui/Icons";
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
  const tint = danger ? colors.refusal : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      accessibilityLabel={
        accessibilityLabel ??
        (hint === undefined ? label : strings.court.menu.hintLabel(label, hint))
      }
      onPress={onPress}
      style={{
        minHeight: tokens.sheet.sizes.menuRow,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s14,
        paddingHorizontal: tokens.spacing.xs,
      }}
    >
      {renderIcon(disabled ? colors.textMuted : tint)}
      <Text
        variant="title"
        style={{
          flexShrink: 1,
          fontFamily: fontFamilies.body600,
          color: disabled ? colors.textMuted : tint,
        }}
      >
        {label}
        {hint === undefined ? null : (
          <Text variant="muted" style={danger ? { color: tint } : undefined}>
            {strings.court.menu.hintAfter(hint)}
          </Text>
        )}
      </Text>
      {chevron ? (
        <View style={{ marginLeft: "auto" }}>
          <ChevronRightIcon color={colors.textMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}
