import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface ErrorStripProps {
  readonly text: string;
}

/** A refusal over the buttons: announced at once, dark text on the yellow strip (AA). */
export function ErrorStrip({ text }: ErrorStripProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.waitingBorder,
        backgroundColor: colors.waitingFill,
      }}
    >
      <Text variant="bodyStrong" style={{ color: colors.text }}>
        {text}
      </Text>
    </View>
  );
}
