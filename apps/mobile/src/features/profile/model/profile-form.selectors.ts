import type { PlayingPosition, SaveMyProfileBody } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { nicknameProblem, normalizedNickname, type NicknameProblem } from "./nickname";
import { inCanonicalOrder, PLAYING_POSITIONS } from "./positions";
import type { ProfileFormState } from "./profile-form.reducer";

const { profile } = strings;

const PROBLEM_TEXT: Readonly<Record<NicknameProblem, string>> = {
  required: profile.nicknameRequired,
  "too-long": profile.nicknameTooLong,
  invalid: profile.nicknameInvalid,
};

/** The text under the nickname field, or `null` when the API would take it. */
export function nicknameError(state: ProfileFormState): string | null {
  const problem = nicknameProblem(state.nickname);
  return problem === null ? null : PROBLEM_TEXT[problem];
}

export function canSubmit(state: ProfileFormState): boolean {
  return nicknameProblem(state.nickname) === null;
}

/** "Também jogo de": the four concrete positions that are not the primary; none without a concrete one. */
export function visibleOthers(state: ProfileFormState): readonly PlayingPosition[] {
  const { primary } = state;
  if (primary === null || primary === "any") return [];
  return PLAYING_POSITIONS.filter((position) => position !== primary);
}

/** The body of "Pronto" and "Salvar": the whole profile, the others in the canonical order. */
export function profileRequest(state: ProfileFormState): SaveMyProfileBody {
  const visible = visibleOthers(state);
  return {
    nickname: normalizedNickname(state.nickname),
    primaryPosition: state.primary,
    otherPositions: [...inCanonicalOrder(state.others.filter((other) => visible.includes(other)))],
    suggestedLevel: state.level,
  };
}

/**
 * "Pular" (question 40): only the nickname, when the field has one the API takes; `null` when there is
 * nothing to save (an empty field, as after a login by e-mail).
 */
export function skipRequest(state: ProfileFormState): SaveMyProfileBody | null {
  if (!canSubmit(state)) return null;
  return {
    nickname: normalizedNickname(state.nickname),
    primaryPosition: null,
    otherPositions: null,
    suggestedLevel: null,
  };
}
