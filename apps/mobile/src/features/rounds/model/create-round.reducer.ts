import type { SettingsValue } from "@sacou/match-engine";

/** The leaves a round may change in screen 20, all with `round` in their levels (tested against the catalog). */
export const PERSONALIZE_PATHS = [
  "scoring.bestOf",
  "scoring.pointsPerSet",
  "rotation.system",
] as const;

export type PersonalizePath = (typeof PERSONALIZE_PATHS)[number];

/** Only what differs from the group: a path absent here inherits. */
export type RoundLayer = Readonly<Partial<Record<PersonalizePath, SettingsValue>>>;

export type CreateRoundSheet =
  | { readonly kind: "none" }
  | { readonly kind: "date" }
  | { readonly kind: "time" }
  | { readonly kind: "setting"; readonly path: PersonalizePath };

/**
 * What the person typed or touched in screen 20, and nothing that can be derived from it. It starts from
 * the group (a new round) or from the round being edited, by the initializer of `useReducer`: never by an
 * effect that copies the query (frontend.md, rule 1).
 */
export interface CreateRoundState {
  readonly localDate: string;
  readonly localTime: string;
  readonly venue: string;
  readonly capacityText: string;
  readonly layer: RoundLayer;
  readonly repeatWeekly: boolean;
  readonly personalizeOpen: boolean;
  readonly sheet: CreateRoundSheet;
}

/** What the person types or picks in the fields of the form. */
type FieldAction =
  | { readonly type: "date-picked"; readonly localDate: string }
  | { readonly type: "time-picked"; readonly localTime: string }
  | { readonly type: "venue-changed"; readonly venue: string }
  | { readonly type: "capacity-changed"; readonly text: string }
  | { readonly type: "repeat-toggled" };

/** The sheets, the "Personalizar" fold and the leaves of the round's layer. */
type PanelAction =
  | { readonly type: "sheet-opened"; readonly sheet: CreateRoundSheet }
  | { readonly type: "sheet-closed" }
  | { readonly type: "layer-set"; readonly path: PersonalizePath; readonly value: SettingsValue }
  | { readonly type: "layer-reset"; readonly path: PersonalizePath }
  | { readonly type: "personalize-toggled" };

export type CreateRoundAction = FieldAction | PanelAction;

const NOT_A_DIGIT = /\D/g;
const NO_SHEET: CreateRoundSheet = { kind: "none" };
const FIELD_ACTIONS: ReadonlySet<CreateRoundAction["type"]> = new Set<FieldAction["type"]>([
  "date-picked",
  "time-picked",
  "venue-changed",
  "capacity-changed",
  "repeat-toggled",
]);

function withoutPath(layer: RoundLayer, path: PersonalizePath): RoundLayer {
  return Object.fromEntries(Object.entries(layer).filter(([key]) => key !== path));
}

function isFieldAction(action: CreateRoundAction): action is FieldAction {
  return FIELD_ACTIONS.has(action.type);
}

function fieldReducer(state: CreateRoundState, action: FieldAction): CreateRoundState {
  switch (action.type) {
    case "date-picked":
      return { ...state, localDate: action.localDate, sheet: NO_SHEET };
    case "time-picked":
      // The sheet edits a draft of its own: only a valid time arrives here, and it closes the sheet.
      return { ...state, localTime: action.localTime, sheet: NO_SHEET };
    case "venue-changed":
      return { ...state, venue: action.venue };
    case "capacity-changed":
      return { ...state, capacityText: action.text.replace(NOT_A_DIGIT, "") };
    case "repeat-toggled":
      return { ...state, repeatWeekly: !state.repeatWeekly };
  }
}

function panelReducer(state: CreateRoundState, action: PanelAction): CreateRoundState {
  switch (action.type) {
    case "sheet-opened":
      return { ...state, sheet: action.sheet };
    case "sheet-closed":
      return { ...state, sheet: NO_SHEET };
    case "layer-set":
      return { ...state, layer: { ...state.layer, [action.path]: action.value }, sheet: NO_SHEET };
    case "layer-reset":
      return { ...state, layer: withoutPath(state.layer, action.path) };
    case "personalize-toggled":
      return { ...state, personalizeOpen: !state.personalizeOpen };
  }
}

/**
 * Pure, and two small exhaustive `switch`es without `default` (frontend.md, rule 4): a new action without
 * a case fails `tsc`.
 */
export function createRoundReducer(
  state: CreateRoundState,
  action: CreateRoundAction,
): CreateRoundState {
  return isFieldAction(action) ? fieldReducer(state, action) : panelReducer(state, action);
}
