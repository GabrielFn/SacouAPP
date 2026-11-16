import type { Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { isFull } from "./presence-card";

const { add } = roundsStrings;

export interface CapacityHint {
  readonly text: string;
  /** Off only for a full list without waitlist: the server would refuse (`round-full`). */
  readonly canAdd: boolean;
}

/** The line under the list of screen 21; `null` without a limit of spots. A forecast: the server decides. */
export function capacityHint(round: Round, waitlistEnabled: boolean): CapacityHint | null {
  const { capacity } = round;
  if (capacity === null) return null;
  if (!isFull(round)) {
    const left = capacity - round.goingCount;
    return {
      text: waitlistEnabled ? add.spotsLeftThenWaitlist(left, capacity) : add.spotsLeft(left),
      canAdd: true,
    };
  }
  return waitlistEnabled
    ? { text: add.fullToWaitlist, canAdd: true }
    : { text: add.full, canAdd: false };
}
