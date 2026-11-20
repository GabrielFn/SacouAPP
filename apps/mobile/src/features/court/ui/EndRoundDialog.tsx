import { strings } from "../../../strings/pt-BR";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";

export interface EndRoundDialogProps {
  /** The score ("12 × 10") of the match in play, or `null` with the dialog closed. */
  readonly score: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Encerrar rodada" with a match in play: that match does not enter the summary (question 151), so the
 * dialog says so before anything is closed. "Cancelar" writes nothing.
 */
export function EndRoundDialog({ score, onConfirm, onCancel }: EndRoundDialogProps) {
  const { endRound } = strings.court;
  return (
    <ConfirmSheet
      visible={score !== null}
      title={endRound.title}
      body={score === null ? "" : endRound.openMatch(score)}
      confirmLabel={endRound.confirm}
      cancelLabel={endRound.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
