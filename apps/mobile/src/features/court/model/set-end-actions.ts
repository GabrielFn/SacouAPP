import type { TeamSide } from "@sacou/match-engine";

import type { ScreenAction } from "../../../ui/ActionButtons";
import type { SetEndModel } from "./court-screen.types";

const SIDES: readonly TeamSide[] = ["a", "b"];

export interface SetEndLabels {
  readonly confirm: string;
  readonly serves: (teamLabel: string) => string;
}

/**
 * The buttons that confirm the end of a set: one to confirm, or one per team when the toss of the
 * deciding set is needed. Every `onPress` ignores the touch event the button hands over, so it can
 * never be read as the first server.
 */
export function buildSetEndActions(
  model: SetEndModel,
  labels: SetEndLabels,
  confirm: (firstServer?: TeamSide) => void,
): readonly ScreenAction[] {
  if (!model.needsFirstServer) {
    return [
      {
        label: labels.confirm,
        onPress: () => {
          confirm();
        },
      },
    ];
  }
  return SIDES.map((side) => ({
    label: labels.serves(model.scores[side].label),
    onPress: () => {
      confirm(side);
    },
  }));
}
