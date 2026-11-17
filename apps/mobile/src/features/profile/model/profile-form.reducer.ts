import type { MyProfile, PlayingPosition, PrimaryPosition } from "../../../services/api/sacou-api";
import { firstName } from "./first-name";

/**
 * The fields of the quick profile while they are edited (frontend.md, rule 4). The saved profile lives
 * only in the query cache: in edit mode it is the initial state, never copied by an effect.
 */
export interface ProfileFormState {
  readonly nickname: string;
  /** Set when the person typed or left the field, so an empty one is not a refusal before that. */
  readonly nicknameTouched: boolean;
  readonly primary: PrimaryPosition | null;
  /** The other positions as tapped; the request puts them in the canonical order. */
  readonly others: readonly PlayingPosition[];
  /** In points as on the wire (`4`); a half point saved elsewhere is kept as it is. */
  readonly level: number | null;
}

export type ProfileFormAction =
  | { readonly type: "nickname-changed"; readonly text: string }
  | { readonly type: "nickname-blurred" }
  | { readonly type: "primary-picked"; readonly position: PrimaryPosition }
  | { readonly type: "other-toggled"; readonly position: PlayingPosition }
  | { readonly type: "level-picked"; readonly level: number };

/** The first access: the first name of the provider and nothing else chosen (question 40). */
export function initFromAccount(displayName: string | null): ProfileFormState {
  return {
    nickname: firstName(displayName),
    nicknameTouched: false,
    primary: null,
    others: [],
    level: null,
  };
}

/** The edit mode (question 60): the saved profile is where the form starts. */
export function initFromProfile(profile: MyProfile): ProfileFormState {
  return {
    nickname: profile.nickname,
    nicknameTouched: false,
    primary: profile.primaryPosition,
    others: profile.otherPositions,
    level: profile.suggestedLevel,
  };
}

function toggled(
  others: readonly PlayingPosition[],
  position: PlayingPosition,
): readonly PlayingPosition[] {
  return others.includes(position)
    ? others.filter((other) => other !== position)
    : [...others, position];
}

export function profileFormReducer(
  state: ProfileFormState,
  action: ProfileFormAction,
): ProfileFormState {
  switch (action.type) {
    case "nickname-changed":
      return { ...state, nickname: action.text, nicknameTouched: true };
    case "nickname-blurred":
      return { ...state, nicknameTouched: true };
    case "primary-picked":
      // The primary leaves the others; "Qualquer uma" has no others at all.
      return {
        ...state,
        primary: action.position,
        others:
          action.position === "any"
            ? []
            : state.others.filter((other) => other !== action.position),
      };
    case "other-toggled":
      if (state.primary === null || state.primary === "any" || state.primary === action.position) {
        return state;
      }
      return { ...state, others: toggled(state.others, action.position) };
    case "level-picked":
      // Tapping the chosen level again clears it, as in the sheet 19a.
      return { ...state, level: state.level === action.level ? null : action.level };
  }
}
