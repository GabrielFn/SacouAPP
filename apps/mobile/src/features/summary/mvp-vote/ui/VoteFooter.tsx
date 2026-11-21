import { Button } from "../../../../ui/Button";

export interface VoteFooterProps {
  /** "Votar em Bia", "Escolha quem foi o MVP" or "Conecte-se para votar". */
  readonly label: string;
  readonly enabled: boolean;
  readonly submitting: boolean;
  readonly onSubmit: () => void;
}

/** The fixed button at the foot of screen 12a: it names the choice, so no dialog asks again (question 171). */
export function VoteFooter({ label, enabled, submitting, onSubmit }: VoteFooterProps) {
  return <Button label={label} onPress={onSubmit} disabled={!enabled} busy={submitting} />;
}
