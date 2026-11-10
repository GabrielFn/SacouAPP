import type { SettingsTemplateKey } from "@sacou/match-engine";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { Theme } from "../../../theme/themes";
import { fontFamilies } from "../../../theme/tokens.data";
import { CheckIcon, PlusIcon } from "../../../ui/Icons";
import { ProBadge } from "../../../ui/ProBadge";
import { Text } from "../../../ui/Text";
import { TemplateIcon } from "./TemplateIcon";

export interface TemplateOptionProps {
  readonly templateKey: SettingsTemplateKey;
  readonly pro: boolean;
  readonly selected: boolean;
  readonly onSelect: (templateKey: SettingsTemplateKey) => void;
}

const FROM_SCRATCH: SettingsTemplateKey = "do-zero";

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

/** One option of the radio group of screen 04. "Do zero" is the dashed one, without a drawing. */
interface OptionLook {
  readonly borderColor: string;
  readonly borderStyle: "solid" | "dashed";
}

function optionLook(selected: boolean, scratch: boolean, colors: Theme): OptionLook {
  if (selected) return { borderColor: colors.primary, borderStyle: "solid" };
  return scratch
    ? { borderColor: colors.borderDashed, borderStyle: "dashed" }
    : { borderColor: colors.borderCard, borderStyle: "solid" };
}

export function TemplateOption({ templateKey, pro, selected, onSelect }: TemplateOptionProps) {
  const { colors, tokens } = useTheme();
  const text = strings.settings.templates[templateKey];
  const scratch = templateKey === FROM_SCRATCH;
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
        minHeight: scratch ? tokens.sizes.templateOptionZeroMin : tokens.sizes.templateOptionMin,
        borderRadius: tokens.radii.tile,
        backgroundColor: scratch ? "transparent" : colors.surface,
        borderWidth: selected ? tokens.borderWidths.thick : tokens.borderWidths.thin,
        ...optionLook(selected, scratch, colors),
      }}
    >
      {scratch ? <PlusIcon /> : <TemplateIcon templateKey={templateKey} />}
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
          <Text
            variant="title"
            style={{ fontSize: scratch ? tokens.fontSizes.field : tokens.fontSizes.button }}
          >
            {text.name}
          </Text>
          {pro ? <ProBadge /> : null}
        </View>
        <Text variant="muted" style={{ fontFamily: fontFamilies.body400 }}>
          {text.line}
        </Text>
      </View>
      {selected ? <SelectedBadge /> : null}
    </Pressable>
  );
}
