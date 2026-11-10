import { SETTINGS_TEMPLATE_KEYS } from "@sacou/match-engine";
import { View } from "react-native";

import type { SavedTemplate, TemplateChoice } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";

const { sheets } = strings.settings;

export interface TemplatePickerSheetProps {
  readonly visible: boolean;
  readonly saved: readonly SavedTemplate[];
  readonly onApply: (choice: TemplateChoice) => void;
  readonly onDelete: (templateId: string) => void;
  readonly onClose: () => void;
}

export interface TemplateLineProps {
  readonly name: string;
  readonly onApply: () => void;
  readonly onDelete?: () => void;
}

function TemplateLine({ name, onApply, onDelete }: TemplateLineProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {name}
      </Text>
      {onDelete === undefined ? null : (
        <Button
          label={sheets.delete}
          accessibilityLabel={sheets.deleteLabel(name)}
          variant="link"
          onPress={onDelete}
        />
      )}
      <Button label={sheets.apply} accessibilityLabel={sheets.applyLabel(name)} onPress={onApply} />
    </View>
  );
}

/** "Modelo usado": the ready-made templates and the group's own, to copy onto the rules (D4). */
export function TemplatePickerSheet({
  visible,
  saved,
  onApply,
  onDelete,
  onClose,
}: TemplatePickerSheetProps) {
  const { tokens } = useTheme();
  return (
    <BottomSheet visible={visible} title={sheets.templatePickerTitle} onClose={onClose}>
      <Text variant="muted">{sheets.templatePickerBody}</Text>
      <View style={{ gap: tokens.spacing.s }}>
        <Text variant="title" accessibilityRole="header">
          {sheets.readyTemplates}
        </Text>
        {SETTINGS_TEMPLATE_KEYS.map((key) => (
          <TemplateLine
            key={key}
            name={strings.settings.templates[key].name}
            onApply={() => {
              onApply({ kind: "ready", key });
            }}
          />
        ))}
      </View>
      {saved.length > 0 ? (
        <View style={{ gap: tokens.spacing.s }}>
          <Text variant="title" accessibilityRole="header">
            {sheets.savedTemplates}
          </Text>
          {saved.map((template) => (
            <TemplateLine
              key={template.templateId}
              name={template.name}
              onApply={() => {
                onApply({ kind: "saved", templateId: template.templateId });
              }}
              onDelete={() => {
                onDelete(template.templateId);
              }}
            />
          ))}
        </View>
      ) : null}
      <Button label={sheets.dismiss} variant="link" onPress={onClose} />
    </BottomSheet>
  );
}
