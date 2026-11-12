import type { CustomBlock } from "./custom-blocks";

/** What screen 04a holds: the blocks that are on, and the one that shows its text. */
export interface CustomBlocksState {
  readonly enabled: readonly CustomBlock[];
  readonly expanded: CustomBlock | null;
}

export type CustomBlocksAction =
  | { readonly type: "block-toggled"; readonly block: CustomBlock }
  | { readonly type: "block-expanded"; readonly block: CustomBlock };

/** Everything is off when the screen opens (D3a). */
export const initialCustomBlocksState: CustomBlocksState = { enabled: [], expanded: null };

export function customBlocksReducer(
  state: CustomBlocksState,
  action: CustomBlocksAction,
): CustomBlocksState {
  switch (action.type) {
    case "block-toggled":
      return {
        ...state,
        enabled: state.enabled.includes(action.block)
          ? state.enabled.filter((block) => block !== action.block)
          : [...state.enabled, action.block],
      };
    case "block-expanded":
      return { ...state, expanded: state.expanded === action.block ? null : action.block };
  }
}
