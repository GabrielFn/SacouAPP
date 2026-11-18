import type { TeamSide } from "@sacou/match-engine";
import { useReducer } from "react";

import { lineupRefusalText } from "../model/lineup-refusal";
import { INITIAL_MATCH_LINEUP, matchLineupReducer } from "../model/match-lineup.reducer";
import type { LineupSource } from "../model/lineup-source";
import { saveMatchLineups, type LineupDispatch } from "../model/save-match-lineups";
import type { LineupScreenProps } from "../ui/LineupScreen";
import { useLineupEditor } from "./use-lineup-editor";

export interface MatchLineupDeps {
  readonly source: LineupSource;
  readonly initialTab: TeamSide;
  readonly dispatch: LineupDispatch;
  /** Back without saving: nothing was changed, or the changes were discarded. */
  readonly onLeave: () => void;
  readonly onSaved: () => void;
}

export interface DiscardPrompt {
  readonly visible: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export interface MatchLineupModel {
  readonly screen: LineupScreenProps;
  readonly discard: DiscardPrompt;
}

/**
 * Screen 22 opened by the menu of the match (D7): the editor of the slice, "Salvar" through the court
 * controller, and "Voltar" that asks first when there is a draft to lose.
 */
export function useMatchLineup(deps: MatchLineupDeps): MatchLineupModel {
  const [state, send] = useReducer(matchLineupReducer, INITIAL_MATCH_LINEUP);
  const editor = useLineupEditor({
    source: deps.source,
    initialTab: deps.initialTab,
    onBack: deps.onLeave,
    onSave: (drafts) => {
      send({ type: "save-started" });
      void saveMatchLineups(deps.dispatch, drafts).then((result) => {
        if (result.ok) {
          deps.onSaved();
        } else {
          send({ type: "save-refused", text: lineupRefusalText(result.error) });
        }
      });
    },
  });
  const { view, handlers } = editor;
  return {
    screen: {
      view,
      handlers: {
        ...handlers,
        onBack: () => {
          if (view.canSave) {
            send({ type: "discard-asked" });
          } else {
            deps.onLeave();
          }
        },
      },
      refusal: state.refusal,
      busy: state.saving,
    },
    discard: {
      visible: state.confirmingDiscard,
      onConfirm: deps.onLeave,
      onCancel: () => {
        send({ type: "discard-cancelled" });
      },
    },
  };
}
