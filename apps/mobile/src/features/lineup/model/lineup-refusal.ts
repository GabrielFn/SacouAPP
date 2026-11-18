import { lineupStrings } from "../../../strings/lineup.pt-BR";
import { refusalText } from "../../court/model/refusal-text";
import type { CommandError } from "../../court/session/court-errors";

const KNOWN: Readonly<Record<string, string | undefined>> = lineupStrings.refusals;

/** Why "Salvar escalação" did nothing in a match: the lineup's words first, then the court's (D7). */
export function lineupRefusalText(error: CommandError): string {
  return error.code === "refused"
    ? (KNOWN[error.reason] ?? refusalText(error))
    : refusalText(error);
}
