import type { Member, MemberLevel, MemberLevelItem } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import {
  SKILL_LEVEL,
  formatLevel,
  levelOf,
  tenthsOf,
  type LevelTenths,
} from "../../../ui/skill-level";

const texts = strings.ratings;

/**
 * What the admin sees of one member (ADR 0047, `perfil-e-nota.md`): the confirmed level, the member's own
 * suggestion while there is no confirmed one, or nothing. Only admins and co-admins ever build this: the
 * levels are not asked for the others.
 */
export type LevelState =
  | { readonly kind: "confirmed"; readonly tenths: LevelTenths }
  | { readonly kind: "suggested"; readonly tenths: LevelTenths; readonly reviewed: boolean }
  | { readonly kind: "none"; readonly reviewed: boolean };

export function levelStateOf(level: MemberLevel | undefined): LevelState {
  const admin = tenthsOf(level?.adminLevel ?? null);
  if (admin !== null) return { kind: "confirmed", tenths: admin };
  const reviewed = level?.reviewed ?? false;
  const suggested = tenthsOf(level?.suggestedLevel ?? null);
  return suggested === null
    ? { kind: "none", reviewed }
    : { kind: "suggested", tenths: suggested, reviewed };
}

export function levelsById(levels: readonly MemberLevel[]): ReadonlyMap<string, MemberLevel> {
  return new Map(levels.map((level) => [level.memberId, level]));
}

/** The level the sheet 19a starts on: the confirmed one, else the suggestion, else 3,0. */
export function startTenths(state: LevelState): LevelTenths {
  return state.kind === "none" ? SKILL_LEVEL.defaultTenths : state.tenths;
}

/** Who still waits for the admin ("N notas para confirmar"): a listed member with no reviewed row. */
export function pendingReviews(
  members: readonly Member[],
  levels: readonly MemberLevel[],
): readonly Member[] {
  const byId = levelsById(levels);
  return members.filter((member) => byId.get(member.memberId)?.reviewed === false);
}

export interface LevelBadgeModel {
  readonly look: "confirmed" | "suggested" | "none";
  readonly value: string;
  /** "sugeriu" under the number; `null` for a confirmed level. */
  readonly caption: string | null;
  readonly accessibilityLabel: string;
}

/** The level card at the right of a row of screen 19 (`.nota`, `.sug`, `.sem`). */
export function levelBadge(name: string, state: LevelState): LevelBadgeModel {
  switch (state.kind) {
    case "confirmed": {
      const value = formatLevel(state.tenths);
      return {
        look: "confirmed",
        value,
        caption: null,
        accessibilityLabel: texts.badge.confirmedLabel(name, value),
      };
    }
    case "suggested": {
      const value = formatLevel(state.tenths);
      return {
        look: "suggested",
        value,
        caption: texts.badge.suggested,
        accessibilityLabel: texts.badge.suggestedLabel(name, value),
      };
    }
    case "none":
      return {
        look: "none",
        value: texts.badge.none,
        caption: null,
        accessibilityLabel: texts.badge.noneLabel(name),
      };
  }
}

/** "Nota do sorteio · 4,0 · sugerida" on the sheet 19c. */
export function optionsLevelText(state: LevelState): string {
  switch (state.kind) {
    case "confirmed":
      return texts.optionsRow.confirmed(formatLevel(state.tenths));
    case "suggested":
      return texts.optionsRow.suggested(formatLevel(state.tenths));
    case "none":
      return state.reviewed ? texts.optionsRow.unknown : texts.optionsRow.none;
  }
}

/** The level of one card of 19b: what the admin typed, else the suggestion, else 3,0. */
export function reviewTenths(
  draft: LevelTenths | undefined,
  suggestion: LevelTenths | null,
): LevelTenths {
  return draft ?? suggestion ?? SKILL_LEVEL.defaultTenths;
}

/** "você ajustou": the admin moved the level away from the suggestion. */
export function isAdjusted(
  draft: LevelTenths | undefined,
  suggestion: LevelTenths | null,
): boolean {
  return draft !== undefined && suggestion !== null && draft !== suggestion;
}

/** A card with no suggestion that nobody touched offers "Não sei" instead of "Confirmar". */
export function offersUnknown(
  draft: LevelTenths | undefined,
  suggestion: LevelTenths | null,
): boolean {
  return draft === undefined && suggestion === null;
}

/** What one card sends: its level, or `null` ("Não sei") when untouched without a suggestion. */
export function reviewItem(
  memberId: string,
  draft: LevelTenths | undefined,
  suggestion: LevelTenths | null,
): MemberLevelItem {
  return {
    memberId,
    level: offersUnknown(draft, suggestion) ? null : levelOf(reviewTenths(draft, suggestion)),
  };
}

/** The batch route takes 1 to 50 members (`groups.level-invalid` above that). */
export const LEVELS_PER_BATCH = 50;

export function inBatches<T>(items: readonly T[]): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / LEVELS_PER_BATCH) }, (_, index) =>
    items.slice(index * LEVELS_PER_BATCH, (index + 1) * LEVELS_PER_BATCH),
  );
}

/** One card of screen 19b: a member the admin has not reviewed yet, with or without a suggestion. */
export interface ReviewCard {
  readonly member: Member;
  readonly suggestion: LevelTenths | null;
}

/** The cards of 19b, in the order of screen 19: who is pending, nothing else (ADR 0047). */
export function reviewCards(
  sortedMembers: readonly Member[],
  levels: readonly MemberLevel[],
): readonly ReviewCard[] {
  const byId = levelsById(levels);
  return pendingReviews(sortedMembers, levels).map((member) => ({
    member,
    suggestion: tenthsOf(byId.get(member.memberId)?.suggestedLevel ?? null),
  }));
}

/** "Ponteira · sugeriu 4,0 · você ajustou", "Ponteiro · sem conta · não sugeriu". */
export function reviewDetail(
  card: ReviewCard,
  draft: LevelTenths | undefined,
  mainPosition: string | null,
): string {
  const review = texts.review;
  const parts = [
    ...(mainPosition === null ? [] : [mainPosition]),
    ...(card.member.hasAccount ? [] : [review.noAccount]),
    card.suggestion === null ? review.notSuggested : review.suggested(formatLevel(card.suggestion)),
    ...(isAdjusted(draft, card.suggestion) ? [review.adjusted] : []),
  ];
  return parts.join(strings.members.row.separator);
}
