import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

const { screen } = strings.settings;

export interface TemplateUsedRowProps {
  readonly name: string;
  /** Only who manages the settings can open the templates and save a new one. */
  readonly canManage: boolean;
  readonly onOpenPicker: () => void;
  readonly onOpenSave: () => void;
}

/** "Modelo usado: Racha organizado" with "Salvar como modelo" at the right (AjustesGrupo.dc.html). */
export function TemplateUsedRow({
  name,
  canManage,
  onOpenPicker,
  onOpenSave,
}: TemplateUsedRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        minHeight: tokens.sizes.settingRowMin,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingLeft: tokens.spacing.s14,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.badgeSurface,
      }}
    >
      <Text variant="muted">{screen.templateUsed}</Text>
      <Pressable
        accessibilityRole={canManage ? "button" : "text"}
        accessibilityLabel={`${screen.templateUsed}: ${name}`}
        disabled={!canManage}
        onPress={onOpenPicker}
        style={{ flex: 1, minHeight: tokens.sizes.switchTarget, justifyContent: "center" }}
      >
        <Text
          numberOfLines={1}
          style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.body }}
        >
          {name}
        </Text>
      </Pressable>
      {canManage ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSave}
          style={{
            minHeight: tokens.sizes.switchTarget,
            justifyContent: "center",
            paddingHorizontal: tokens.spacing.s10,
          }}
        >
          <Text
            style={{
              color: colors.link,
              fontFamily: fontFamilies.body700,
              fontSize: tokens.fontSizes.small,
            }}
          >
            {screen.saveAsTemplate}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
