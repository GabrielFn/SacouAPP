import type { TeamSide } from "@sacou/match-engine";
import { useReducer } from "react";

import {
  draftsToSave,
  initialLineupEditorState,
  lineupEditorReducer,
  type LineupBase,
} from "../model/lineup-editor.reducer";
import type { LineupDraft } from "../model/lineup-moves";
import { lineupView } from "../model/lineup-selectors";
import { basesOf, type LineupSource } from "../model/lineup-source";
import type { LineupScreenProps } from "../ui/LineupScreen";

export interface LineupEditorDeps {
  readonly source: LineupSource;
  readonly initialTab: TeamSide;
  readonly onBack: () => void;
  /** The teams the admin changed, still on their base (D3). */
  readonly onSave: (drafts: Readonly<Partial<Record<TeamSide, LineupDraft>>>) => void;
}

/**
 * Screen 22 for any host (D1): the editing state lives in its reducer, the base comes from the host on
 * each render and goes with each action, never copied by an effect (frontend.md, rules 1 and 4).
 */
export function useLineupEditor(deps: LineupEditorDeps): LineupScreenProps {
  const { source } = deps;
  const [state, dispatch] = useReducer(
    lineupEditorReducer,
    deps.initialTab,
    initialLineupEditorState,
  );
  const base: LineupBase | null = source.teams[state.tab].base;
  const withBase = (edit: (shown: LineupBase) => void) => {
    if (base !== null) edit(base);
  };
  return {
    view: lineupView(state, source),
    handlers: {
      onBack: deps.onBack,
      onTab: (side) => {
        dispatch({ type: "tab-chosen", side });
      },
      onPlayer: (memberId) => {
        withBase((shown) => {
          dispatch({ type: "player-tapped", base: shown, memberId });
        });
      },
      onRotation: (zone) => {
        withBase((shown) => {
          dispatch({ type: "rotation-chosen", base: shown, zone });
        });
      },
      onMakeSetter: () => {
        withBase((shown) => {
          dispatch({ type: "setter-chosen", base: shown });
        });
      },
      onFixRoles: () => {
        withBase((shown) => {
          dispatch({ type: "roles-fixed", base: shown, positionOf: source.positionOf });
        });
      },
      onLibero: (memberId) => {
        withBase((shown) => {
          dispatch({ type: "libero-chosen", base: shown, memberId });
        });
      },
      onSave: () => {
        deps.onSave(draftsToSave(state, basesOf(source)));
      },
    },
  };
}
