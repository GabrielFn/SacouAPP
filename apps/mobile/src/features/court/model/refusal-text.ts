import { strings } from "../../../strings/pt-BR";
import type { CommandError } from "../session/court-errors";

const KNOWN: Readonly<Record<string, string | undefined>> = {
  ...strings.court.refusals,
  ...strings.courtPlayers.refusals,
};

/** What a screen says when a command did not go through. The text of a code, never of a value. */
export function refusalText(error: CommandError): string {
  const { generic } = strings.court.refusals;
  return error.code === "refused" ? (KNOWN[error.reason] ?? generic) : generic;
}
