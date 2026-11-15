import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";

export interface ListRowFrameProps {
  readonly children: ReactNode;
}

/** The row shape shared by the lists of screen 19 (members and invites). */
export function ListRowFrame({ children }: ListRowFrameProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.memberRowMin,
        paddingLeft: tokens.spacing.m,
      }}
    >
      {children}
    </View>
  );
}
