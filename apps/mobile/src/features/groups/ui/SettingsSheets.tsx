import { strings } from "../../../strings/pt-BR";
import type { GroupSettingsScreenModel } from "../hooks/use-group-settings-screen";
import type { SettingsReady } from "../model/settings-screen-state";
import { ScheduleSheet } from "./ScheduleSheet";
import { TemplatePickerSheet } from "./TemplatePickerSheet";
import { TextSheet } from "./TextSheet";

const { sheets, fields } = strings.settings;

export interface SettingsSheetsProps {
  readonly model: GroupSettingsScreenModel;
  readonly ready: SettingsReady;
}

/** The sheet of one number, amount or text of a field; closed unless the reducer says "field". */
function FieldSheet({ model }: Pick<SettingsSheetsProps, "model">) {
  const { sheet } = model.form;
  if (sheet.kind !== "field") return null;
  return (
    <TextSheet
      visible
      title={fields[sheet.path]}
      label={fields[sheet.path]}
      value={sheet.text}
      error={model.sheetError}
      canConfirm={model.canConfirmSheet}
      onChange={model.setSheetText}
      onConfirm={model.confirmSheet}
      onCancel={model.cancelSheet}
    />
  );
}

function SaveTemplateSheet({ model }: Pick<SettingsSheetsProps, "model">) {
  const { sheet } = model.form;
  if (sheet.kind !== "save-template") return null;
  return (
    <TextSheet
      visible
      title={sheets.saveTitle}
      label={sheets.saveName}
      value={sheet.name}
      placeholder={sheets.saveNamePlaceholder}
      error={model.sheetError}
      confirmLabel={sheets.save}
      canConfirm={model.canConfirmSheet}
      onChange={model.setSheetText}
      onConfirm={model.confirmSheet}
      onCancel={model.cancelSheet}
    />
  );
}

function DayAndTimeSheet({ model }: Pick<SettingsSheetsProps, "model">) {
  const { sheet } = model.form;
  if (sheet.kind !== "schedule") return null;
  return (
    <ScheduleSheet
      visible
      weekday={sheet.weekday}
      time={sheet.time}
      error={model.sheetError ?? undefined}
      onWeekdayChange={model.setSheetWeekday}
      onTimeChange={model.setSheetText}
      onConfirm={model.confirmSheet}
      onCancel={model.cancelSheet}
    />
  );
}

/** The four sheets of screen 18; only the one named by the reducer is drawn. */
export function SettingsSheets({ model, ready }: SettingsSheetsProps) {
  return (
    <>
      <FieldSheet model={model} />
      <SaveTemplateSheet model={model} />
      <DayAndTimeSheet model={model} />
      <TemplatePickerSheet
        visible={model.form.sheet.kind === "template-picker"}
        saved={ready.saved}
        onApply={model.applyTemplate}
        onDelete={model.deleteTemplate}
        onClose={model.cancelSheet}
      />
    </>
  );
}
