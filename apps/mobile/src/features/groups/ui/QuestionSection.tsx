import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface QuestionSectionProps {
  /** The orange number of the question; omitted for the heading without one. */
  readonly number?: number;
  readonly title: string;
  readonly children: ReactNode;
}

/** A question of screen 05 with its orange numeral (.lg in CriarPerguntas.dc.html). */
export function QuestionSection({ number, title, children }: QuestionSectionProps) {
  const { tokens } = useTheme();
  return (
    <View accessibilityRole="none" style={{ gap: tokens.spacing.s }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: tokens.spacing.s6 }}>
        {number === undefined ? null : (
          <Text variant="display">
            {String(number)}
          </Text>
        )}
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
