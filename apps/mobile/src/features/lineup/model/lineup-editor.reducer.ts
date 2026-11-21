import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { SetterZone } from "@sacou/volley-rules";

import type { PositionOf } from "../../draw/model/default-lineup";
import { fixRoles } from "./fix-roles";
import {
  reanchor,
  swapInLineup,
  toggleBench,
  withLibero,
  withSetterZone,
  type LiberoExit,
  type LineupDraft,
} from "./lineup-moves";

/** What a team starts from on screen 22: never stored here, it comes with each action (D3). */
export interface LineupBase {
  readonly side: TeamSide;
  readonly state: LineupDraft;
  /** Changes when the base changes under the draft: the team or system (pre-game), the log (match). */
  readonly key: string;
  readonly liberoExit: LiberoExit;
}

/** A draft and the key of the base it started from: another key means the base moved (D3). */
export interface TeamDraft {
  readonly allocation: LineupDraft;
  readonly baseKey: string;
}

export interface LineupEditorState {
  readonly tab: TeamSide;
  readonly selection: MemberId | null;
  /** Only after the first change; the screen shows `draft ?? base`. */
  readonly drafts: Readonly<Partial<Record<TeamSide, TeamDraft>>>;
}

export type LineupEditorAction =
  | { readonly type: "tab-chosen"; readonly side: TeamSide }
  | { readonly type: "player-tapped"; readonly base: LineupBase; readonly memberId: MemberId }
  | { readonly type: "rotation-chosen"; readonly base: LineupBase; readonly zone: SetterZone }
  /** "Tornar levantador" of the selected member. */
  | { readonly type: "setter-chosen"; readonly base: LineupBase }
  /** "Corrigir". */
  | { readonly type: "roles-fixed"; readonly base: LineupBase; readonly positionOf: PositionOf }
  | {
      readonly type: "libero-chosen";
      readonly base: LineupBase;
      readonly memberId: MemberId | null;
    }
  /** A reserve of the queue goes to the bench of the team or comes back; `pool` is who may (R96). */
  | {
      readonly type: "bench-toggled";
      readonly base: LineupBase;
      readonly memberId: MemberId;
      readonly pool: readonly MemberId[];
    }
  | { readonly type: "selection-cleared" }
  | { readonly type: "draft-discarded"; readonly side: TeamSide };

export function initialLineupEditorState(tab: TeamSide): LineupEditorState {
  return { tab, selection: null, drafts: {} };
}

/** What the screen shows for a team: the draft, unless the base moved under it (D3). */
export function shownAllocation(state: LineupEditorState, base: LineupBase): LineupDraft {
  const draft = state.drafts[base.side];
  return draft !== undefined && draft.baseKey === base.key ? draft.allocation : base.state;
}

function sameAllocation(left: LineupDraft, right: LineupDraft): boolean {
  return (
    left.setterZone === right.setterZone &&
    left.libero?.memberId === right.libero?.memberId &&
    left.lineup.join() === right.lineup.join() &&
    left.bench.join() === right.bench.join()
  );
}

type Drafts = LineupEditorState["drafts"];

function withoutSide(drafts: Drafts, side: TeamSide): Drafts {
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== side));
}

/** Back to the base, the draft goes, so "Salvar" turns off (the engine would say `lineup-unchanged`). */
function edited(
  state: LineupEditorState,
  base: LineupBase,
  edit: (shown: LineupDraft) => LineupDraft,
): LineupEditorState {
  const next = edit(shownAllocation(state, base));
  const others = withoutSide(state.drafts, base.side);
  const drafts = sameAllocation(next, base.state)
    ? others
    : { ...others, [base.side]: { allocation: next, baseKey: base.key } };
  return { ...state, selection: null, drafts };
}

function playerTapped(
  state: LineupEditorState,
  base: LineupBase,
  memberId: MemberId,
): LineupEditorState {
  const shown = shownAllocation(state, base);
  // The libero changes on the "Líbero" row, never by a tap on the court (D5).
  if (!shown.lineup.includes(memberId)) return state;
  const { selection } = state;
  if (selection === null) return { ...state, selection: memberId };
  if (selection === memberId) return { ...state, selection: null };
  return edited(state, base, (draft) => swapInLineup(draft, selection, memberId));
}

function setterChosen(state: LineupEditorState, base: LineupBase): LineupEditorState {
  const { selection } = state;
  return selection === null ? state : edited(state, base, (draft) => reanchor(draft, selection));
}

function discarded(state: LineupEditorState, side: TeamSide): LineupEditorState {
  return { ...state, selection: null, drafts: withoutSide(state.drafts, side) };
}

/** Screen 22 (frontend.md, rule 4): the tab, the selection and the drafts; the rest is derived. */
export function lineupEditorReducer(
  state: LineupEditorState,
  action: LineupEditorAction,
): LineupEditorState {
  switch (action.type) {
    case "tab-chosen":
      return { ...state, tab: action.side, selection: null };
    case "player-tapped":
      return playerTapped(state, action.base, action.memberId);
    case "rotation-chosen":
      return edited(state, action.base, (draft) => withSetterZone(draft, action.zone));
    case "setter-chosen":
      return setterChosen(state, action.base);
    case "roles-fixed":
      return edited(state, action.base, (draft) => fixRoles(draft, action.positionOf));
    case "libero-chosen":
      return edited(state, action.base, (draft) =>
        withLibero(draft, action.memberId, action.base.liberoExit),
      );
    case "bench-toggled":
      return edited(state, action.base, (draft) =>
        toggleBench(draft, action.memberId, action.pool),
      );
    case "selection-cleared":
      return { ...state, selection: null };
    case "draft-discarded":
      return discarded(state, action.side);
  }
}

/** The drafts still on their base, to save; a moved base drops its draft (D3). */
export function draftsToSave(
  state: LineupEditorState,
  bases: readonly LineupBase[],
): Readonly<Partial<Record<TeamSide, LineupDraft>>> {
  return Object.fromEntries(
    bases.flatMap((base) => {
      const draft = state.drafts[base.side];
      return draft === undefined || draft.baseKey !== base.key
        ? []
        : [[base.side, draft.allocation] as const];
    }),
  );
}

/** A draft that started from another base: the screen tells and shows the base (D3). */
export function isDraftStale(state: LineupEditorState, base: LineupBase): boolean {
  const draft = state.drafts[base.side];
  return draft !== undefined && draft.baseKey !== base.key;
}
