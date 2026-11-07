import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { palette } from "../theme/tokens.data";

import { Text } from "./Text";

export type StatusKind = "confirmed" | "waiting" | "pay";

export interface StatusPillProps {
  readonly label: string;
  readonly status: StatusKind;
}

/** Not interactive: exempt from the touch target floor. */
export function StatusPill({ label, status }: StatusPillProps) {
  const { colors, tokens } = useTheme();
  const look = {
    confirmed: { fill: colors.text, border: colors.text, text: colors.background },
    waiting: { fill: palette.waitingFill, border: palette.waitingBorder, text: palette.night },
    pay: { fill: colors.primary, border: colors.primary, text: colors.onPrimary },
  }[status];
  return (
    <View
      style={{
        minHeight: tokens.sizes.statusPill,
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: look.border,
        backgroundColor: look.fill,
        paddingHorizontal: tokens.spacing.m,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
      }}
    >
      <Text variant="caption" style={{ color: look.text }}>
        {label}
      </Text>
    </View>
  );
}
