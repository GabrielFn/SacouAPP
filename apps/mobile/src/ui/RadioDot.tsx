import { View } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface RadioDotProps {
  readonly selected: boolean;
}

/** The ring of a radio (RegraFila.dc.html, VotarMvp.dc.html .rd): thick and orange when chosen. Drawing only. */
export function RadioDot({ selected }: RadioDotProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.sizes.radioDot;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: selected ? tokens.sizes.radioDotSelectedBorder : tokens.borderWidths.thick,
        borderColor: selected ? colors.primary : colors.trackOff,
      }}
    />
  );
}
