import type { SettingsTemplateKey } from "@sacou/match-engine";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { HeadedBlock } from "../../../ui/HeadedBlock";
import { CheckIcon } from "../../../ui/Icons";
import { ProBadge } from "../../../ui/ProBadge";
import { Text } from "../../../ui/Text";
import { TemplateIcon } from "./TemplateIcon";

export interface TemplateOptionProps {
  readonly templateKey: SettingsTemplateKey;
  readonly pro: boolean;
  readonly selected: boolean;
  readonly onSelect: (templateKey: SettingsTemplateKey) => void;
}

function SelectedBadge() {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        width: tokens.sizes.selectedBadge,
        height: tokens.sizes.selectedBadge,
        borderRadius: tokens.radii.pill,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CheckIcon color={colors.text} />
    </View>
  );
}

/** One option of the radio group of screen 04 ("Do zero" is a link, not an option). */
export function TemplateOption({ templateKey, pro, selected, onSelect }: TemplateOptionProps) {
  const { colors, tokens } = useTheme();
  const text = strings.settings.templates[templateKey];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${text.name}. ${text.line}`}
      onPress={() => {
        onSelect(templateKey);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s14,
        padding: tokens.spacing.s14,
        minHeight: tokens.sizes.templateOptionMin,
        borderRadius: tokens.radii.tile,
        backgroundColor: colors.surface,
        borderWidth: selected ? tokens.borderWidths.thick : tokens.borderWidths.thin,
        borderColor: selected ? colors.primary : colors.borderCard,
      }}
    >
      <TemplateIcon templateKey={templateKey} />
      <HeadedBlock
        heading={
          <>
            <Text variant="title" style={{ fontSize: tokens.fontSizes.button }}>
              {text.name}
            </Text>
            {pro ? <ProBadge /> : null}
          </>
        }
      >
        <Text variant="muted" style={{ fontFamily: fontFamilies.body400 }}>
          {text.line}
        </Text>
      </HeadedBlock>
      {selected ? <SelectedBadge /> : null}
    </Pressable>
  );
}
