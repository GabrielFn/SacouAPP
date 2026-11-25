import { strings } from "../../../strings/pt-BR";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";

export interface EndRoundDialogProps {
  /** What the dialog says, or `null` with the dialog closed. */
  readonly body: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Encerrar rodada" always asks first (R101): the matches played, the one in play that stays out of the
 * summary (question 151) and what comes next. "Continuar jogando" writes nothing.
 */
export function EndRoundDialog({ body, onConfirm, onCancel }: EndRoundDialogProps) {
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
