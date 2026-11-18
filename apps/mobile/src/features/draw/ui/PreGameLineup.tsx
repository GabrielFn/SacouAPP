import { Modal } from "react-native";

import { LineupScreen } from "../../lineup/ui/LineupScreen";
import { useLineupEditor } from "../../lineup/hooks/use-lineup-editor";
import type { DrawScreenModel } from "../hooks/use-draw-screen";
import type { MatchStartInput } from "../model/match-start";
import { preGameLineupSource, savedLineupsOf } from "../model/pre-game-lineup-source";

export interface PreGameLineupProps {
  readonly model: DrawScreenModel;
  readonly input: MatchStartInput;
  readonly matchNumber: number;
}

/**
 * Screen 22 opened by the 08 (D1): over the 07, in its flow, so the draw and its levels never leave
 * it. Only IDs, names and positions reach the screen. "Voltar" and "Salvar" go back to the 08.
 */
function PreGameLineupBody({ model, input, matchNumber }: PreGameLineupProps) {
  const close = () => {
    model.dispatch({ type: "lineup-closed" });
  };
  const screen = useLineupEditor({
    source: preGameLineupSource(input, model.nameOf, matchNumber),
    initialTab: input.preGame.rotationTab,
    onBack: close,
    onSave: (drafts) => {
      model.dispatch({ type: "lineup-saved", lineups: savedLineupsOf(drafts) });
    },
  });
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <LineupScreen view={screen.view} handlers={screen.handlers} />
    </Modal>
  );
}

/** Mounted only while the 22 is open, so its drafts go when it closes (D3). */
export function PreGameLineup(props: PreGameLineupProps) {
  return props.model.state.sheet === "lineup" ? <PreGameLineupBody {...props} /> : null;
}
