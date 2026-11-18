import type { UnsentSummary } from "../../court/ports/court-sync";
import { strings } from "../../../strings/pt-BR";

export interface SignOutFlowDeps {
  readonly countUnsent: () => Promise<UnsentSummary>;
  readonly signOut: () => void;
  /** Shows the warning of question 84 with the events not sent yet. */
  readonly warn: (unsent: UnsentSummary) => void;
}

/**
 * "Sair" (D8, question 84): with court events of this account the server has not confirmed, it warns
 * first; the logout never erases them, and only this account ever sends them.
 */
export async function signOutOrWarn({
  countUnsent,
  signOut,
  warn,
}: SignOutFlowDeps): Promise<void> {
  const unsent = await countUnsent();
  if (unsent.events > 0) {
    warn(unsent);
    return;
  }
  signOut();
}

/** The body of the warning: the points when there are some, the other marks otherwise. */
export function unsentWarningText({ points }: UnsentSummary): string {
  const texts = strings.account.unsent;
  return points > 0 ? texts.points(points) : texts.otherEvents;
}
