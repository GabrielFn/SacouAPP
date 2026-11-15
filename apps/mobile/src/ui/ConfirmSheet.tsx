import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Text } from "./Text";

export interface ConfirmSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** A "yes or no" before something that cannot be undone, with the red button (ADR 0049, D7). */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onCancel}>
      <Text variant="muted">{body}</Text>
      <Button label={confirmLabel} variant="danger" onPress={onConfirm} />
      <Button label={cancelLabel} variant="outline" onPress={onCancel} />
    </BottomSheet>
  );
}
