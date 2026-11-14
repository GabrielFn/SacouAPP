import type { KeyboardTypeOptions } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";

const { sheets } = strings.settings;

export interface TextSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly error?: string | null;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly confirmLabel?: string;
  /** The confirm is off while the draft cannot be saved. */
  readonly canConfirm: boolean;
  readonly onChange: (text: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** A sheet with one text field, confirm and cancel: a number, the venue, an amount, a template name. */
export function TextSheet({
  visible,
  title,
  label,
  value,
  placeholder,
  hint,
  error,
  keyboardType,
  confirmLabel = sheets.confirm,
  canConfirm,
  onChange,
  onConfirm,
  onCancel,
}: TextSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onCancel}>
      <TextField
        label={label}
        value={value}
        placeholder={placeholder}
        help={hint}
        error={error ?? undefined}
        keyboardType={keyboardType}
        onChangeText={onChange}
      />
      <Button
        label={confirmLabel}
        onPress={() => {
          if (canConfirm) onConfirm();
        }}
      />
      <Button label={sheets.cancel} variant="link" onPress={onCancel} />
    </BottomSheet>
  );
}
