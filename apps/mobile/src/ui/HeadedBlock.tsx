import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface HeadedBlockProps {
  /** The heading line: a title and its badge, side by side. */
  readonly heading: ReactNode;
  /** What goes under the heading line. */
  readonly children: ReactNode;
}

/** A text column that fills the row: a heading line with a badge and the lines under it. */
export function HeadedBlock({ heading, children }: HeadedBlockProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        {heading}
      </View>
      {children}
    </View>
  );
}
