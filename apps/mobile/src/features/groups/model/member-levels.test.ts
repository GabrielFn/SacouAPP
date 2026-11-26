import { describe, expect, test } from "vitest";

import type { MemberLevel } from "../../../services/api/sacou-api";
import { SKILL_LEVEL } from "../../../ui/skill-level";
import { confirmAllItems } from "../hooks/use-rating-review";
import { levelLookupOf, levelSheetOf } from "../hooks/use-members-screen";
import {
  inBatches,
  isAdjusted,
  levelBadge,
  levelStateOf,
  offersUnknown,
  optionsLevelText,
  pendingReviews,
  reviewCards,
  reviewDetail,
  reviewItem,
  startTenths,
} from "./member-levels";
import { initialMembersScreenState, membersScreenReducer } from "./members-screen.reducer";
import { member } from "./members.test.fixture";
import { initialRatingReviewState, ratingReviewReducer } from "./rating-review.reducer";

function level(
  memberId: string,
  adminLevel: number | null,
  reviewed: boolean,
  suggestedLevel: number | null,
): MemberLevel {
  return { memberId, adminLevel, reviewed, suggestedLevel };
}

const joao = member("j", "admin", { isMe: true, nickname: "João" });
const bia = member("b", "player", { nickname: "Bia", primaryPosition: "outsideHitter" });
const caio = member("c", "player", { nickname: "Caio", primaryPosition: "opposite" });
const leo = member("l", "player", {
  nickname: "Léo",
  hasAccount: false,
  primaryPosition: "outsideHitter",
});
const members = [joao, bia, caio, leo];
const levels = [
  level("j", 3.5, true, null),
  level("b", null, false, 4),
  level("c", null, false, 4.5),
  level("l", null, false, null),
];

describe("the level of a row (Membros.dc.html)", () => {
  test("confirmed, suggested or none", () => {
    expect(levelBadge("João", levelStateOf(levels[0]))).toEqual({
      look: "confirmed",
      value: "3,5",
      caption: null,
      accessibilityLabel: "Nota de João: 3,5. Alterar",
    });
    expect(levelBadge("Bia", levelStateOf(levels[1]))).toMatchObject({
      look: "suggested",
      value: "4,0",
      caption: "sugeriu",
      accessibilityLabel: "Bia sugeriu 4,0, ainda sem nota confirmada. Definir",
    });
    expect(levelBadge("Léo", levelStateOf(levels[3]))).toMatchObject({
      look: "none",
      value: "– sem nota",
    });
  });

  test("a level off the scale is never shown as a level", () => {
    expect(levelStateOf(level("x", 4.25, true, 7))).toEqual({ kind: "none", reviewed: true });
  });

  test("the sheet 19c says Nota do sorteio · 4,0 · sugerida", () => {
    expect(optionsLevelText(levelStateOf(levels[1]))).toBe("4,0 · sugerida");
    expect(optionsLevelText(levelStateOf(levels[0]))).toBe("3,5");
    expect(optionsLevelText(levelStateOf(level("x", null, true, null)))).toBe("Não sei · definir");
    expect(optionsLevelText(levelStateOf(undefined))).toBe("sem nota · definir");
  });

  test("N notas para confirmar counts only listed members not reviewed", () => {
    expect(pendingReviews(members, levels).map((m) => m.memberId)).toEqual(["b", "c", "l"]);
    expect(pendingReviews([joao, bia], [...levels, level("gone", null, false, 3)])).toHaveLength(1);
  });

  test("the sheet 19a starts on the level, else the suggestion, else 3,0", () => {
    expect(startTenths(levelStateOf(levels[0]))).toBe(35);
    expect(startTenths(levelStateOf(levels[1]))).toBe(40);
    expect(startTenths(levelStateOf(levels[3]))).toBe(SKILL_LEVEL.defaultTenths);
  });
});

describe("the sheet 19a on screen 19 (D9)", () => {
  const lookup = levelLookupOf(levels);

  test("Placar and Jogador have no lookup, so no sheet", () => {
    expect(levelLookupOf(undefined)).toBeNull();
    expect(levelSheetOf(members, null, { memberId: "b", draft: null })).toBeNull();
  });

  test("Usar 4,0, the shortcut 3, Agora não", () => {
    const opened = membersScreenReducer(initialMembersScreenState, {
      type: "level-opened",
      memberId: "c",
    });
    expect(levelSheetOf(members, lookup, opened.level)?.shown).toBe(45);
    const used = membersScreenReducer(opened, { type: "level-drafted", tenths: 40 });
    expect(levelSheetOf(members, lookup, used.level)?.shown).toBe(40);
    const shortcut = membersScreenReducer(used, { type: "level-drafted", tenths: 30 });
    expect(levelSheetOf(members, lookup, shortcut.level)?.shown).toBe(30);
    expect(membersScreenReducer(shortcut, { type: "level-closed" })).toEqual(
      initialMembersScreenState,
    );
  });

  test("one modal at a time: 19c, 19a and the confirmation replace each other", () => {
    const options = membersScreenReducer(initialMembersScreenState, {
      type: "sheet-opened",
      memberId: "b",
    });
    const rating = membersScreenReducer(options, { type: "level-opened", memberId: "b" });
    expect(rating.sheetMemberId).toBeNull();
    const removing = membersScreenReducer(rating, {
      type: "member-confirm-asked",
      kind: "remove",
      memberId: "b",
    });
    expect(removing).toEqual({
      sheetMemberId: null,
      level: null,
      confirm: { kind: "remove", memberId: "b" },
    });
    expect(
      membersScreenReducer(initialMembersScreenState, { type: "level-drafted", tenths: 40 }),
    ).toEqual(initialMembersScreenState);
  });

  test("a member who left closes the sheet by itself", () => {
    expect(levelSheetOf([joao], lookup, { memberId: "b", draft: 40 })).toBeNull();
  });
});

describe("screen 19b, Revisar notas (D9)", () => {
  const cards = reviewCards(members, levels);

  test("only who has no reviewed level, with or without a suggestion", () => {
    expect(cards.map((card) => [card.member.memberId, card.suggestion])).toEqual([
      ["b", 40],
      ["c", 45],
      ["l", null],
    ]);
  });

  test("the texts of each card, and você ajustou when the draft differs", () => {
    const [bCard, cCard, lCard] = cards;
    if (bCard === undefined || cCard === undefined || lCard === undefined) throw new Error("cards");
    expect(reviewDetail(bCard, undefined, "Ponteiro")).toBe("Ponteiro · sugeriu 4,0");
    expect(reviewDetail(cCard, 35, "Oposto")).toBe("Oposto · sugeriu 4,5 · você ajustou");
    expect(reviewDetail(cCard, 45, "Oposto")).toBe("Oposto · sugeriu 4,5");
    expect(reviewDetail(lCard, undefined, "Ponteiro")).toBe("Ponteiro · sem conta · não sugeriu");
    expect(isAdjusted(undefined, 40)).toBe(false);
    expect(isAdjusted(30, null)).toBe(false);
  });

  test("Não sei only on an untouched card without a suggestion", () => {
    expect(offersUnknown(undefined, null)).toBe(true);
    expect(offersUnknown(35, null)).toBe(false);
    expect(offersUnknown(undefined, 40)).toBe(false);
    expect(reviewItem("l", undefined, null)).toEqual({ memberId: "l", level: null });
    expect(reviewItem("l", 25, null)).toEqual({ memberId: "l", level: 2.5 });
  });

  test("Confirmar todas (3) sends the draft, else the suggestion, else Não sei", () => {
    const state = ratingReviewReducer(initialRatingReviewState, {
      type: "drafted",
      memberId: "c",
      tenths: 35,
    });
    expect(confirmAllItems(cards, state)).toEqual([
      { memberId: "b", level: 4 },
      { memberId: "c", level: 3.5 },
      { memberId: "l", level: null },
    ]);
  });

  test("what went in leaves the drafts; the others keep them", () => {
    const drafted = [
      { type: "drafted", memberId: "b", tenths: 30 },
      { type: "drafted", memberId: "c", tenths: 35 },
    ] as const;
    const state = drafted.reduce(ratingReviewReducer, initialRatingReviewState);
    expect(ratingReviewReducer(state, { type: "sent", memberIds: ["b"] })).toEqual({
      drafts: { c: 35 },
    });
  });

  test("batches of 50 at most", () => {
    const items = Array.from({ length: 101 }, (_, index) => index);
    expect(inBatches(items).map((batch) => batch.length)).toEqual([50, 50, 1]);
    expect(inBatches([])).toEqual([]);
  });
});
