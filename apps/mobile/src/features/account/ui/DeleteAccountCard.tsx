import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface DeleteAccountCardProps {
  readonly onDelete: () => void;
}

const texts = strings.account;

/** The red card at the end of screen 30 (Conta.dc.html `#del-title`), with "Excluir" of 44. */
export function DeleteAccountCard({ onDelete }: DeleteAccountCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.m,
        backgroundColor: colors.dangerFill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.danger,
        borderRadius: tokens.radii.tile,
        paddingHorizontal: tokens.spacing.s14,
        paddingVertical: tokens.spacing.s10,
      }}
    >
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ color: colors.dangerTitle }}>
          {texts.deleteTitle}
        </Text>
        <Text variant="muted" style={{ fontSize: tokens.fontSizes.caption }}>
          {texts.deleteNote}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={texts.deleteButtonA11y}
        onPress={onDelete}
        style={{
          minHeight: tokens.sizes.minTouchTarget,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.s14,
          borderRadius: tokens.radii.field,
          backgroundColor: colors.danger,
        }}
      >
        <Text variant="bodyStrong" style={{ color: colors.surface, fontSize: tokens.fontSizes.small }}>
          {texts.deleteButton}
        </Text>
      </Pressable>
    </View>
  );
}
