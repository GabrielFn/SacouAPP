import { drawStrings } from "../../../strings/draw.pt-BR";
import { dateLabel } from "../../rounds/model/round-dates";
import type { OtherCourtView } from "./other-court-view";

const { closeOther } = drawStrings.preGame;

/** "Há uma partida aberta da rodada de qui, 19/11. Encerrar a antiga e começar esta?" (R97, D5). */
export function closeOtherBody(other: OtherCourtView): string {
  const date = other.kind === "forgotten" && other.localDate !== null ? other.localDate : null;
  return closeOther.body(date === null ? null : dateLabel(date).toLowerCase());
}
