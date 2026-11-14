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

/** What the person typed or touched in screen 20, and nothing that can be derived from it. */
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

export type CreateRoundAction =
  | { readonly type: "init"; readonly state: CreateRoundState }
  | { readonly type: "date-picked"; readonly localDate: string }
  | { readonly type: "time-picked"; readonly localTime: string }
  | { readonly type: "venue-changed"; readonly venue: string }
  | { readonly type: "capacity-changed"; readonly text: string }
  | { readonly type: "sheet-opened"; readonly sheet: CreateRoundSheet }
  | { readonly type: "sheet-closed" }
  | { readonly type: "layer-set"; readonly path: PersonalizePath; readonly value: SettingsValue }
  | { readonly type: "layer-reset"; readonly path: PersonalizePath }
  | { readonly type: "repeat-toggled" }
  | { readonly type: "personalize-toggled" };

const NOT_A_DIGIT = /\D/g;
const NO_SHEET: CreateRoundSheet = { kind: "none" };

function withoutPath(layer: RoundLayer, path: PersonalizePath): RoundLayer {
  return Object.fromEntries(Object.entries(layer).filter(([key]) => key !== path));
}

export function createRoundReducer(
  state: CreateRoundState,
  action: CreateRoundAction,
): CreateRoundState {
  switch (action.type) {
    case "init":
      return action.state;
    case "date-picked":
      return { ...state, localDate: action.localDate, sheet: NO_SHEET };
    case "time-picked":
      return { ...state, localTime: action.localTime };
    case "venue-changed":
      return { ...state, venue: action.venue };
    case "capacity-changed":
      return { ...state, capacityText: action.text.replace(NOT_A_DIGIT, "") };
    case "sheet-opened":
      return { ...state, sheet: action.sheet };
    case "sheet-closed":
      return { ...state, sheet: NO_SHEET };
    case "layer-set":
      return { ...state, layer: { ...state.layer, [action.path]: action.value }, sheet: NO_SHEET };
    case "layer-reset":
      return { ...state, layer: withoutPath(state.layer, action.path) };
    case "repeat-toggled":
      return { ...state, repeatWeekly: !state.repeatWeekly };
    case "personalize-toggled":
      return { ...state, personalizeOpen: !state.personalizeOpen };
  }
}
