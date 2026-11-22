import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { closeOtherBody } from "../model/close-other-text";
import type { OtherCourtView } from "../model/other-court-view";

const { closeOther: texts } = strings.draw.preGame;

export interface CloseOtherSheetProps {
  readonly visible: boolean;
  readonly other: OtherCourtView;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Encerrar a partida antiga?" over the 08 (R97, D5): the match forgotten in a round that already
 * ended is ended by hand and closed, and then this one starts. Its points keep being sent.
 */
export function CloseOtherSheet({ visible, other, onConfirm, onCancel }: CloseOtherSheetProps) {
  return (
    <BottomSheet visible={visible} title={texts.title} closeLabel={texts.cancel} onClose={onCancel}>
      <Text variant="body">{closeOtherBody(other)}</Text>
      <Text variant="muted">{texts.note}</Text>
      <Button label={texts.confirm} onPress={onConfirm} />
      <Button label={texts.cancel} variant="secondary" onPress={onCancel} />
    </BottomSheet>
  );
}
