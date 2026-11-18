import { strings } from "../../../strings/pt-BR";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { endMatchSentence, type EndMatchSummary } from "../model/menu-selectors";

export interface EndMatchDialogProps {
  readonly visible: boolean;
  readonly summary: EndMatchSummary;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Encerrar a partida agora?": the match cannot be reopened after it ends (ADR 0030), so the dialog
 * says who wins before anything is written. "Cancelar" writes nothing.
 */
export function EndMatchDialog({ visible, summary, onConfirm, onCancel }: EndMatchDialogProps) {
  const { endMatchDialog } = strings.court;
  return (
    <ConfirmSheet
      visible={visible}
      title={endMatchDialog.title}
      body={endMatchSentence(summary)}
      confirmLabel={endMatchDialog.confirm}
      cancelLabel={endMatchDialog.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
