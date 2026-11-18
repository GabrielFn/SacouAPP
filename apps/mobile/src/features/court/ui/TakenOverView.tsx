import { strings } from "../../../strings/pt-BR";
import { ErrorScreen } from "../../../ui/ErrorScreen";

export interface TakenOverViewProps {
  readonly onLeave: () => void;
}

/**
 * Screen 09b in its first form (D7, Parte 1): another phone writes the court now, so this one takes no
 * gesture and only leaves. The name of who took over and "Assumir de volta" come with E3.8.
 */
export function TakenOverView({ onLeave }: TakenOverViewProps) {
  const { takenOver } = strings.court;
  return (
    <ErrorScreen
      title={takenOver.title}
      body={takenOver.body}
      actions={[{ label: takenOver.leave, onPress: onLeave }]}
    />
  );
}
