import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface FieldFrameProps {
  readonly label: string;
  readonly children: ReactNode;
}

/** A form field: its label above, and the control (with its help or error) below. */
export function FieldFrame({ label, children }: FieldFrameProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.small }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
