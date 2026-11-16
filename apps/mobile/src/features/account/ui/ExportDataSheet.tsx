import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { useExportData } from "../hooks/use-export-data";

export interface ExportDataSheetProps {
  readonly onClose: () => void;
}

const texts = strings.account.exportSheet;

/** The four lines of what goes in the file (ExportarDados.dc.html `.card .row`). */
function ExportContents() {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
      }}
    >
      {texts.items.map((item, index) => (
        <View
          key={item}
          style={{
            minHeight: tokens.sizes.settingRowMin,
            justifyContent: "center",
            paddingHorizontal: tokens.spacing.s14,
            paddingVertical: tokens.spacing.s,
            borderTopWidth: index === 0 ? 0 : tokens.borderWidths.thin,
            borderTopColor: colors.borderDivider,
          }}
        >
          <Text variant="body">{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Sheet 30a, "Exportar meus dados", mounted only while open: the file goes to the share sheet of the
 * phone instead of an e-mail (E4.3, D9). It closes by itself after the share sheet closes.
 */
export function ExportDataSheet({ onClose }: ExportDataSheetProps) {
  const model = useExportData();
  return (
    <BottomSheet visible title={texts.title} onClose={onClose}>
      <Text variant="muted">{texts.intro}</Text>
      <ExportContents />
      <Text variant="muted">{texts.where}</Text>
      {model.message === null ? null : (
        <Text variant="caption" accessibilityRole="alert">
          {model.message}
        </Text>
      )}
      <Button
        label={model.pending ? texts.generating : texts.generate}
        disabled={model.pending}
        onPress={() => {
          model.generate(onClose);
        }}
      />
      <Button label={texts.notNow} variant="outline" onPress={onClose} />
    </BottomSheet>
  );
}
