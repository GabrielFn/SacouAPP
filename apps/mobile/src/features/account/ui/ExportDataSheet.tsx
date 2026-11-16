import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { useExportData } from "../hooks/use-export-data";
import { LinesCard } from "./LinesCard";

export interface ExportDataSheetProps {
  readonly onClose: () => void;
}

const texts = strings.account.exportSheet;

/**
 * Sheet 30a, "Exportar meus dados", mounted only while open: the file goes to the share sheet of the
 * phone instead of an e-mail (E4.3, D9). It closes by itself after the share sheet closes.
 */
export function ExportDataSheet({ onClose }: ExportDataSheetProps) {
  const model = useExportData();
  return (
    <BottomSheet visible title={texts.title} onClose={onClose}>
      <Text variant="muted">{texts.intro}</Text>
      <LinesCard lines={texts.items} />
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
