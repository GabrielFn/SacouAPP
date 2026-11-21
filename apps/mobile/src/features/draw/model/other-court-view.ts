import type { RoundEnd } from "../../court/ports/round-end-lookup";
import type { OtherRoundCourt } from "../../court/session/other-round-court";
import { hasRoundEnded } from "../../court/session/round-end";

/** What the 08 does about a match open in another round on this device (R97, D2 and D5). */
export type OtherCourtView =
  | { readonly kind: "none" }
  /** Its round is still on (or not known): "Abrir a partida aberta", and the start stays off. */
  | { readonly kind: "open"; readonly courtSessionId: string }
  /** Its round ended and it is this account's: "Começar" asks to end it first (the sheet). */
  | {
      readonly kind: "forgotten";
      readonly courtSessionId: string;
      /** The local date of its round ("2026-11-19"), when the cache still lists it. */
      readonly localDate: string | null;
    }
  /** Its round ended and another account opened it: nothing here may end it (D8). */
  | { readonly kind: "other-account" };

const NONE: OtherCourtView = { kind: "none" };

/**
 * The decision of the 08 over the court of another round: only a match of a round that has ended,
 * opened by the account signed in, may be ended from here. A sample session has no round: it is
 * always "open" (ended from its own Menu).
 */
export function otherCourtView(
  other: OtherRoundCourt | null,
  end: RoundEnd,
  now: number,
): OtherCourtView {
  if (other === null) return NONE;
  const ended = other.origin === null ? null : hasRoundEnded(end, now);
  if (ended !== true || other.ownership === "account-pending") {
    return { kind: "open", courtSessionId: other.courtSessionId };
  }
  if (other.ownership !== "own") return { kind: "other-account" };
  return {
    kind: "forgotten",
    courtSessionId: other.courtSessionId,
    localDate: end.kind === "listed" ? end.localDate : null,
  };
}
