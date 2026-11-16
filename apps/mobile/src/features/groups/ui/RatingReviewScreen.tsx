import { Pressable, View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Avatar } from "../../../ui/Avatar";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { CheckIcon, LockIcon, MinusIcon, PlusIcon } from "../../../ui/Icons";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { canStep, formatLevel, stepLevel } from "../../../ui/skill-level";
import { StepButton } from "../../../ui/Stepper";
import { Text } from "../../../ui/Text";
import { useRatingReview, type RatingReviewModel } from "../hooks/use-rating-review";
import {
  isAdjusted,
  offersUnknown,
  reviewDetail,
  reviewTenths,
  type ReviewCard,
} from "../model/member-levels";
import { initialsOf, memberName, positionsText } from "../model/members.selectors";
import { draftOf } from "../model/rating-review.reducer";
import { groupMembersHref } from "../navigation";

const texts = strings.ratings.review;

export interface ReviewCardViewProps {
  readonly card: ReviewCard;
  readonly model: RatingReviewModel;
}

/** One card (`.card`): the level between minus and plus, and "Confirmar" or "Não sei". */
function ReviewCardView({ card, model }: ReviewCardViewProps) {
  const { colors, tokens } = useTheme();
  const { member, suggestion } = card;
  const name = memberName(member);
  const draft = draftOf(model.state, member.memberId);
  const value = reviewTenths(draft, suggestion);
  const untouched = offersUnknown(draft, suggestion);
  const level = formatLevel(value);
  const step = (direction: -1 | 1) => {
    model.dispatch({
      type: "drafted",
      memberId: member.memberId,
      tenths: stepLevel(value, direction),
    });
  };
  return (
    <View
      accessibilityLabel={name}
      style={{
        gap: tokens.spacing.s10,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: isAdjusted(draft, suggestion) ? colors.waitingBorder : colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
        <Avatar initials={initialsOf(member)} dashed={!member.hasAccount} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="muted">{reviewDetail(card, draft, positionsText(member)[0] ?? null)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <StepButton
          label={texts.less(name)}
          enabled={!model.pending && canStep(value, -1)}
          onPress={() => {
            step(-1);
          }}
        >
          <MinusIcon />
        </StepButton>
        <Text
          variant="display"
          displaySize="displayLevelCard"
          tabular
          style={{ textAlign: "center", color: untouched ? colors.textMuted : colors.text }}
        >
          {level}
        </Text>
        <StepButton
          label={texts.more(name)}
          enabled={!model.pending && canStep(value, 1)}
          onPress={() => {
            step(1);
          }}
        >
          <PlusIcon />
        </StepButton>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          {untouched ? (
            <Button
              label={texts.unknown}
              accessibilityLabel={texts.unknownLabel(name)}
              variant="link"
              disabled={model.pending}
              onPress={() => {
                model.unknown(card);
              }}
            />
          ) : (
            <ConfirmButton
              label={texts.confirmLabel(name, level)}
              disabled={model.pending}
              onPress={() => {
                model.confirmOne(card);
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export interface ConfirmButtonProps {
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

/** The small dark "✓ Confirmar" (`.ok`). */
function ConfirmButton({ label, disabled, onPress }: ConfirmButtonProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s6,
        minHeight: tokens.sizes.minTouchTarget,
        paddingHorizontal: tokens.spacing.s14,
        borderRadius: tokens.radii.field,
        backgroundColor: colors.text,
      }}
    >
      <CheckIcon color={colors.background} />
      <Text variant="bodyStrong" style={{ color: colors.background }}>
        {texts.confirm}
      </Text>
    </Pressable>
  );
}

/** What the screen can show yet: nothing for Placar and Jogador, a wait, or the cards. */
export type ReviewGate =
  | { readonly kind: "forbidden" }
  | { readonly kind: "waiting"; readonly failure: Error | null }
  | { readonly kind: "ready" };

export function reviewGate(model: RatingReviewModel): ReviewGate {
  const { group, members, levels } = model;
  if (group.data !== undefined && !model.allowed) return { kind: "forbidden" };
  const loaded =
    group.data !== undefined && members.data !== undefined && levels.data !== undefined;
  return loaded
    ? { kind: "ready" }
    : { kind: "waiting", failure: group.error ?? members.error ?? levels.error };
}

export interface ReviewGateViewProps {
  readonly gate: Exclude<ReviewGate, { readonly kind: "ready" }>;
}

function ReviewGateView({ gate }: ReviewGateViewProps) {
  if (gate.kind === "forbidden") {
    return <EmptyState title={texts.notAllowedTitle} body={texts.notAllowed} />;
  }
  return gate.failure === null ? (
    <LoadingState accessibilityLabel={texts.loading} />
  ) : (
    <EmptyState alert title={texts.loadError} body={errorTextOf(gate.failure)} />
  );
}

export interface RatingReviewScreenProps {
  readonly groupId: string;
}

/** Screen 19b, "Revisar notas": admins and co-admins only (ADR 0047). */
export function RatingReviewScreen({ groupId }: RatingReviewScreenProps) {
  const { tokens } = useTheme();
  const model = useRatingReview(groupId);
  const { group } = model;
  const back = (
    <BackBar
      title={texts.header(group.data?.name ?? "")}
      fallbackHref={groupMembersHref(groupId)}
    />
  );
  const gate = reviewGate(model);
  if (gate.kind !== "ready") {
    return (
      <Screen>
        {back}
        <ReviewGateView gate={gate} />
      </Screen>
    );
  }
  const total = model.cards.length;
  return (
    <Screen
      scroll
      footer={
        total === 0 ? undefined : (
          <Button
            label={texts.confirmAll(total)}
            disabled={model.pending}
            onPress={model.confirmAll}
          />
        )
      }
    >
      {back}
      <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
        {texts.title}
      </Text>
      <Text variant="muted">{texts.intro}</Text>
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      {total === 0 ? <Text variant="muted">{texts.done}</Text> : null}
      <View style={{ gap: tokens.spacing.s10 }}>
        {model.cards.map((card) => (
          <ReviewCardView key={card.member.memberId} card={card} model={model} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
        <LockIcon />
        <Text variant="muted">{texts.privacy}</Text>
      </View>
    </Screen>
  );
}
