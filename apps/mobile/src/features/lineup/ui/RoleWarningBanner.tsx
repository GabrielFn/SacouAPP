import { View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { WarningIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

export interface RoleWarningBannerProps {
  readonly text: string;
  /** "Corrigir", or `null` for a notice with nothing to fix (a base that moved). */
  readonly onFix: (() => void) | null;
}

/** The yellow strip "Lia e Ana estão fora de ordem" with "Corrigir" (Escalacao.dc.html, D4). */
export function RoleWarningBanner({ text, onFix }: RoleWarningBannerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        minHeight: tokens.sizes.orderCell,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        paddingVertical: tokens.spacing.xs,
        paddingLeft: tokens.spacing.m,
        paddingRight: tokens.spacing.xs,
        borderRadius: tokens.radii.button,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.text,
        backgroundColor: colors.accent,
      }}
    >
      <WarningIcon color={colors.text} />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {text}
      </Text>
      {onFix === null ? null : (
        <Button label={texts.fixRoles} variant="secondary" onPress={onFix} />
      )}
    </View>
  );
}
