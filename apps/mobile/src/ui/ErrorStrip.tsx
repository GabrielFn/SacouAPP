import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface ErrorStripProps {
  readonly text: string;
  /** With both, the strip offers a button that closes the message (the screen decides what closing does). */
  readonly dismissLabel?: string;
  readonly onDismiss?: () => void;
}

/** A refusal over the buttons: announced at once, dark text on the yellow strip (AA). */
export function ErrorStrip({ text, dismissLabel, onDismiss }: ErrorStripProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: tokens.spacing.m,
        gap: tokens.spacing.xs,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.waitingBorder,
        backgroundColor: colors.waitingFill,
      }}
    >
      <Text variant="bodyStrong" style={{ color: colors.text }}>
        {text}
      </Text>
      {dismissLabel === undefined || onDismiss === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          style={{ minHeight: tokens.sizes.minTouchTarget, justifyContent: "center" }}
        >
          <Text
            variant="bodyStrong"
            style={{ color: colors.text, textDecorationLine: "underline" }}
          >
            {dismissLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
