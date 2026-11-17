import type { Href } from "expo-router";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Text } from "../../../ui/Text";

export interface DrawHeaderProps {
  /** "Racha de terça · 14 confirmados". */
  readonly header: string;
  /** "2 times de 6 + 2 reservas", or the text of the state while there are no teams. */
  readonly title: string;
  readonly backHref: Href;
}

/** The back button with the group and the count, and the big title (Sorteio.dc.html). */
export function DrawHeader({ header, title, backHref }: DrawHeaderProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <BackBar title={header} fallbackHref={backHref} />
      <Text
        variant="display"
        accessibilityRole="header"
        style={{ fontSize: tokens.fontSizes.drawTitle }}
      >
        {title}
      </Text>
    </View>
  );
}
