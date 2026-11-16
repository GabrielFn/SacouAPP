import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { Member, MemberLevel, MemberLevelItem } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useServices } from "../../../services/services-context";
import { canManageLevels } from "../model/member-actions";
import { reviewCards, reviewItem, type ReviewCard } from "../model/member-levels";
import { sortMembers } from "../model/members.selectors";
import {
  draftOf,
  initialRatingReviewState,
  ratingReviewReducer,
  type RatingReviewAction,
  type RatingReviewState,
} from "../model/rating-review.reducer";
import {
  confirmAllMutation,
  setLevelMutation,
  type ConfirmAllOutcome,
} from "../queries/level-mutations";
import { useGroup, useGroupMembers, useMemberLevels } from "../queries/use-group-queries";

export interface RatingReviewModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly members: ReturnType<typeof useGroupMembers>;
  readonly levels: ReturnType<typeof useMemberLevels>;
  /** `false` for Placar and Jogador: the levels are never asked for them (ADR 0047). */
  readonly allowed: boolean;
  /** Derived each render from the cache: a confirmed member leaves because the server says so. */
  readonly cards: readonly ReviewCard[];
  readonly state: RatingReviewState;
  readonly dispatch: (action: RatingReviewAction) => void;
  readonly pending: boolean;
  readonly errorText: string | null;
  readonly confirmOne: (card: ReviewCard) => void;
  readonly unknown: (card: ReviewCard) => void;
  readonly confirmAll: () => void;
}

/** What each card sends now: its draft, else the suggestion, else `null` ("Não sei"). */
export function confirmAllItems(
  cards: readonly ReviewCard[],
  state: RatingReviewState,
): readonly MemberLevelItem[] {
  return cards.map((card) =>
    reviewItem(card.member.memberId, draftOf(state, card.member.memberId), card.suggestion),
  );
}

function cardsOf(
  members: readonly Member[] | undefined,
  levels: readonly MemberLevel[] | undefined,
): readonly ReviewCard[] {
  return members === undefined || levels === undefined
    ? []
    : reviewCards(sortMembers(members), levels);
}

/** The text of the last refusal, or how many levels of "Confirmar todas" did not go in. */
export function reviewErrorText(
  oneError: unknown,
  allError: unknown,
  outcome: ConfirmAllOutcome | undefined,
): string | null {
  const failure = oneError ?? allError ?? null;
  if (failure !== null) return errorTextOf(failure);
  const failed = outcome?.failed ?? 0;
  return failed > 0 ? strings.ratings.review.partial(failed) : null;
}

/** Screen 19b: the cards come from the cache, only the drafts live in the reducer (D9). */
export function useRatingReview(groupId: string): RatingReviewModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const deps = { api: sacouApi, client };
  const group = useGroup(groupId);
  const allowed = group.data !== undefined && canManageLevels(group.data.role);
  const members = useGroupMembers(groupId);
  const levels = useMemberLevels(groupId, allowed);
  const [state, dispatch] = useReducer(ratingReviewReducer, initialRatingReviewState);
  const one = useMutation(setLevelMutation(deps, groupId));
  const all = useMutation(confirmAllMutation(deps, groupId));
  const cards = allowed ? cardsOf(members.data, levels.data) : [];
  const sent = (memberIds: readonly string[]) => {
    dispatch({ type: "sent", memberIds });
  };
  const send = (item: MemberLevelItem) => {
    one.mutate(item, {
      onSuccess: () => {
        sent([item.memberId]);
      },
    });
  };
  return {
    group,
    members,
    levels,
    allowed,
    cards,
    state,
    dispatch,
    pending: one.isPending || all.isPending,
    errorText: reviewErrorText(one.error, all.error, all.data),
    confirmOne: (card) => {
      const memberId = card.member.memberId;
      send(reviewItem(memberId, draftOf(state, memberId), card.suggestion));
    },
    unknown: (card) => {
      send({ memberId: card.member.memberId, level: null });
    },
    confirmAll: () => {
      all.mutate(confirmAllItems(cards, state), {
        onSuccess: (outcome) => {
          sent(outcome.sent);
        },
      });
    },
  };
}
