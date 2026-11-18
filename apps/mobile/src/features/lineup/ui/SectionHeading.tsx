import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface SectionHeadingProps {
  readonly title: string;
  /** The muted line on the right: "Laranja sacando", "Sem banco (6 jogadores)". */
  readonly detail: string;
}

/** The heading of a block of screen 22, its detail pushed to the right (Escalacao.dc.html). */
export function SectionHeading({ title, detail }: SectionHeadingProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}>
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="muted" style={{ marginLeft: "auto" }}>
        {detail}
      </Text>
    </View>
  );
}
