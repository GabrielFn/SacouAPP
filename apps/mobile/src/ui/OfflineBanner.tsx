import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface OfflineBannerProps {
  readonly text: string;
}

/** The strip over data kept from the last time ("Sem conexão · atualizado há 2 h"). Drawing only. */
export function OfflineBanner({ text }: OfflineBannerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.waitingFill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.waitingBorder,
        borderRadius: tokens.radii.field,
        paddingHorizontal: tokens.spacing.m,
        paddingVertical: tokens.spacing.s,
      }}
    >
      <Text variant="muted" style={{ color: colors.text }}>
        {text}
      </Text>
    </View>
  );
}
