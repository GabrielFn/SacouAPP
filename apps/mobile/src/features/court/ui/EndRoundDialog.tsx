import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { Text } from "../../../ui/Text";
import type { EndRoundSheet } from "../end-round/end-round-view";

export interface EndRoundDialogProps {
  /** The sheet to show, or `null` with the dialog closed. */
  readonly sheet: EndRoundSheet | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Encerrar rodada" always asks first (R101): the matches played, the one in play that stays out of the
 * summary (question 151) and what comes next. Before the start time with no match finished the round
 * cannot be closed (ADR 0076), so the sheet only explains. "Continuar jogando" writes nothing.
 */
export function EndRoundDialog({ sheet, onConfirm, onCancel }: EndRoundDialogProps) {
  if (sheet === null)
    return <ConfirmEndRoundSheet body={null} onConfirm={onConfirm} onCancel={onCancel} />;
  switch (sheet.kind) {
    case "confirm":
      return <ConfirmEndRoundSheet body={sheet.body} onConfirm={onConfirm} onCancel={onCancel} />;
    case "not-started":
      return <EndRoundNotStartedSheet body={sheet.body} onCancel={onCancel} />;
  }
}

export interface ConfirmEndRoundSheetProps {
  readonly body: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmEndRoundSheet({ body, onConfirm, onCancel }: ConfirmEndRoundSheetProps) {
  const { endRound } = strings.court;
  return (
    <ConfirmSheet
      visible={body !== null}
      title={endRound.title}
      body={body ?? ""}
      confirmLabel={endRound.confirm}
      cancelLabel={endRound.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export interface EndRoundNotStartedSheetProps {
  readonly body: string;
  readonly onCancel: () => void;
}

/** The round has not started: no "Encerrar rodada" button, only the way back to the court. */
function EndRoundNotStartedSheet({ body, onCancel }: EndRoundNotStartedSheetProps) {
  const { endRound } = strings.court;
  return (
    <BottomSheet visible title={endRound.title} onClose={onCancel}>
      <Text variant="muted">{body}</Text>
      <Button label={endRound.cancel} variant="outline" onPress={onCancel} />
    </BottomSheet>
  );
}
