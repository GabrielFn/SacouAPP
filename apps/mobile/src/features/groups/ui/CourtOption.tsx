import type { SettingsModality } from "@sacou/match-engine";
import { Pressable } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { CourtIcon } from "./TemplateIcon";

export interface CourtOptionProps {
  readonly modality: SettingsModality;
  readonly selected: boolean;
  readonly onSelect: (modality: SettingsModality) => void;
}

/** One of the three "Onde vocês jogam?" buttons: the chosen one is dark, as in the canvas. */
export function CourtOption({ modality, selected, onSelect }: CourtOptionProps) {
  const { colors, tokens } = useTheme();
  const foreground = selected ? colors.background : colors.text;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        onSelect(modality);
      }}
      style={{
        flex: 1,
        minHeight: tokens.sizes.courtOption,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs,
        borderRadius: tokens.radii.button,
        borderWidth: tokens.borderWidths.thin,
        borderColor: selected ? colors.text : colors.borderChip,
        backgroundColor: selected ? colors.text : colors.surface,
      }}
    >
      <CourtIcon modality={modality} color={foreground} />
      <Text
        style={{
          color: foreground,
          fontFamily: selected ? fontFamilies.body700 : fontFamilies.body600,
          fontSize: tokens.fontSizes.small,
        }}
      >
        {strings.settings.choices["format.modality"]?.[modality] ?? modality}
      </Text>
    </Pressable>
  );
}
