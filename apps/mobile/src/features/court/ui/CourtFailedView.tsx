import { strings } from "../../../strings/pt-BR";
import { ErrorScreen } from "../../../ui/ErrorScreen";

export interface CourtFailedViewProps {
  readonly onRetry: () => void;
  readonly onLeave: () => void;
}

/** "Não conseguimos abrir esta partida": nothing is erased, the match stays in the file. */
export function CourtFailedView({ onRetry, onLeave }: CourtFailedViewProps) {
  const { error } = strings.court;
  return (
    <ErrorScreen
      title={error.title}
      body={error.body}
      actions={[
        { label: error.retry, onPress: onRetry },
        { label: error.back, variant: "secondary", onPress: onLeave },
      ]}
    />
  );
}
