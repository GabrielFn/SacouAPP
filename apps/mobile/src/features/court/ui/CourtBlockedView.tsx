import { strings } from "../../../strings/pt-BR";
import { ErrorScreen } from "../../../ui/ErrorScreen";
import type { CourtBlock } from "../hooks/use-court-screen-model";

export interface CourtBlockedViewProps {
  readonly block: CourtBlock;
  readonly onLeave: () => void;
}

const TEXTS = {
  "taken-over": strings.court.takenOver,
  "other-account": strings.court.otherAccount,
} as const satisfies Record<CourtBlock, unknown>;

/**
 * The court that takes no gesture, only "Sair da quadra": screen 09b in its first form (D7, Parte 1),
 * another phone writes the court now; or the session of another account (D8), whose points leave
 * only with it. The name of who took over and "Assumir de volta" come with E3.8.
 */
export function CourtBlockedView({ block, onLeave }: CourtBlockedViewProps) {
  const texts = TEXTS[block];
  return (
    <ErrorScreen
      title={texts.title}
      body={texts.body}
      actions={[{ label: texts.leave, onPress: onLeave }]}
    />
  );
}
