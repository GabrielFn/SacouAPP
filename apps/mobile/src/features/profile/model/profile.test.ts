import { describe, expect, test } from "vitest";

import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import {
  createStoredOnboardingSkip,
  ONBOARDING_SKIP_KEY,
} from "../../../adapters/stored-onboarding-skip";
import type { MyProfile, SaveMyProfileBody } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { firstName } from "./first-name";
import { NICKNAME_FIELD_LIMIT } from "./nickname";
import { onboardingGate, type ProfileQueryView } from "./onboarding-gate";
import {
  initFromAccount,
  initFromProfile,
  profileFormReducer,
  type ProfileFormAction,
  type ProfileFormState,
} from "./profile-form.reducer";
import {
  canSubmit,
  nicknameError,
  profileRequest,
  skipRequest,
  visibleOthers,
} from "./profile-form.selectors";
import { SELF_LEVEL_OPTIONS } from "./self-levels";
import { skipQuickProfile } from "./skip-quick-profile";

const FAMILY = "👨‍👩‍👧‍👦";
const RIGHT_TO_LEFT_OVERRIDE = "‮";
const { profile: texts } = strings;

function form(...actions: readonly ProfileFormAction[]): ProfileFormState {
  return actions.reduce(profileFormReducer, initFromAccount("João Ferreira"));
}

const SAVED: MyProfile = {
  nickname: "Jota",
  primaryPosition: "middleBlocker",
  otherPositions: ["setter"],
  suggestedLevel: 3,
};

describe("the first name suggested as nickname (question 40)", () => {
  test.each([
    ["João Ferreira", "João"],
    ["  maria  clara ", "maria"],
    [null, ""],
    [`${FAMILY} Ana`, FAMILY],
    ["a".repeat(21), ""],
    ["a".repeat(20), "a".repeat(20)],
    [`${RIGHT_TO_LEFT_OVERRIDE}Ana Souza`, ""],
    ["...", ""],
  ])("%o gives %o", (displayName, expected) => {
    expect(firstName(displayName)).toBe(expected);
  });
});

describe("the form reducer of screen 27", () => {
  test("starts with the first name and nothing chosen", () => {
    expect(initFromAccount("João Ferreira")).toEqual({
      nickname: "João",
      primary: null,
      others: [],
      level: null,
    });
  });

  test("picking a primary takes it out of the others", () => {
    const state = form(
      { type: "primary-picked", position: "outsideHitter" },
      { type: "other-toggled", position: "opposite" },
    );
    expect(state.others).toEqual(["opposite"]);
    const swapped = profileFormReducer(state, { type: "primary-picked", position: "opposite" });
    expect(swapped.others).toEqual([]);
    expect(swapped.primary).toBe("opposite");
  });

  test("'Qualquer uma' empties the others and hides the block", () => {
    const state = form(
      { type: "primary-picked", position: "setter" },
      { type: "other-toggled", position: "libero" },
      { type: "primary-picked", position: "any" },
    );
    expect(state.others).toEqual([]);
    expect(visibleOthers(state)).toEqual([]);
    expect(profileFormReducer(state, { type: "other-toggled", position: "libero" })).toBe(state);
  });

  test("without a primary there are no others to mark", () => {
    const state = form();
    expect(visibleOthers(state)).toEqual([]);
    expect(profileFormReducer(state, { type: "other-toggled", position: "setter" })).toBe(state);
  });

  test("the four that are not the primary can all be marked, and a second tap unmarks", () => {
    const four = form(
      { type: "primary-picked", position: "middleBlocker" },
      { type: "other-toggled", position: "libero" },
      { type: "other-toggled", position: "setter" },
      { type: "other-toggled", position: "opposite" },
      { type: "other-toggled", position: "outsideHitter" },
    );
    expect(visibleOthers(four)).toEqual(["setter", "outsideHitter", "opposite", "libero"]);
    expect(four.others).toHaveLength(4);
    const three = profileFormReducer(four, { type: "other-toggled", position: "setter" });
    expect(three.others).not.toContain("setter");
  });

  test("the five options are the whole levels 1 to 5 with the texts of the canvas", () => {
    expect(SELF_LEVEL_OPTIONS.map((option) => option.level)).toEqual([1, 2, 3, 4, 5]);
    expect(SELF_LEVEL_OPTIONS[3]?.text).toBe("Sou dos bons da pelada");
  });

  test("a level is picked, and the same level again clears it", () => {
    const four = form({ type: "level-picked", level: 4 });
    expect(profileRequest(four).suggestedLevel).toBe(4);
    expect(profileFormReducer(four, { type: "level-picked", level: 4 }).level).toBeNull();
    expect(profileFormReducer(four, { type: "level-picked", level: 2 }).level).toBe(2);
  });

  test("the edit mode starts from the saved profile", () => {
    expect(initFromProfile(SAVED)).toEqual({
      nickname: "Jota",
      primary: "middleBlocker",
      others: ["setter"],
      level: 3,
    });
    expect(profileRequest(initFromProfile(SAVED))).toEqual(SAVED);
  });

  test("a half point saved elsewhere is kept as it is", () => {
    expect(profileRequest(initFromProfile({ ...SAVED, suggestedLevel: 4.5 })).suggestedLevel).toBe(
      4.5,
    );
  });

  test("the switch is exhaustive", () => {
    // @ts-expect-error: an action the reducer does not know does not compile.
    const unknown: ProfileFormAction = { type: "teleported" };
    expect(unknown.type).toBe("teleported");
  });
});

describe("the request of 'Pronto'", () => {
  test("is the body of the canvas, the others in the canonical order", () => {
    const state = form(
      { type: "nickname-changed", text: "  João " },
      { type: "primary-picked", position: "outsideHitter" },
      { type: "other-toggled", position: "libero" },
      { type: "other-toggled", position: "opposite" },
      { type: "level-picked", level: 4 },
    );
    expect(profileRequest(state)).toEqual({
      nickname: "João",
      primaryPosition: "outsideHitter",
      otherPositions: ["opposite", "libero"],
      suggestedLevel: 4,
    });
  });

  test.each([
    ["", texts.nicknameRequired],
    ["   ", texts.nicknameRequired],
    ["...", texts.nicknameInvalid],
    [`${RIGHT_TO_LEFT_OVERRIDE}Ana`, texts.nicknameInvalid],
    ["a".repeat(21), texts.nicknameTooLong],
  ])("the nickname %o turns 'Pronto' off with a text", (text, error) => {
    const state = form({ type: "nickname-changed", text });
    expect(canSubmit(state)).toBe(false);
    expect(nicknameError(state)).toBe(error);
  });

  test("twenty characters with emojis are accepted, and the field never cuts them", () => {
    for (const text of [`${FAMILY}${"a".repeat(16)}`, "😀".repeat(20)]) {
      const state = form({ type: "nickname-changed", text });
      expect(canSubmit(state)).toBe(true);
      expect(nicknameError(state)).toBeNull();
      expect(text.length).toBeLessThanOrEqual(NICKNAME_FIELD_LIMIT);
    }
    expect(canSubmit(form({ type: "nickname-changed", text: "😀".repeat(21) }))).toBe(false);
  });
});

describe("'Pular' (question 40)", () => {
  function skipWith(state: ProfileFormState) {
    const store = createMemoryKeyValueStore();
    const onboardingSkip = createStoredOnboardingSkip(store);
    const saved: SaveMyProfileBody[] = [];
    skipQuickProfile(state, {
      onboardingSkip,
      save: (body) => {
        saved.push(body);
      },
    });
    return { saved, store, onboardingSkip };
  }

  test("with 'João' saves only the nickname, once", () => {
    const state = form(
      { type: "primary-picked", position: "setter" },
      { type: "level-picked", level: 5 },
    );
    const { saved, onboardingSkip } = skipWith(state);
    expect(saved).toEqual([
      { nickname: "João", primaryPosition: null, otherPositions: null, suggestedLevel: null },
    ]);
    expect(onboardingSkip.snapshot()).toBe("skipped");
  });

  test("with an empty field saves nothing and keeps the flag", async () => {
    const state = initFromAccount(null);
    expect(skipRequest(state)).toBeNull();
    const { saved, store } = skipWith(state);
    expect(saved).toEqual([]);
    await Promise.resolve();
    expect(store.entries().get(ONBOARDING_SKIP_KEY)).toBe("1");
  });
});

describe("the gate of screen 27 (nobody is held there)", () => {
  const missing: ProfileQueryView = { status: "success", data: null };
  test.each([
    ["404 without the flag", missing, "notSkipped", "show"],
    ["404 with the flag", missing, "skipped", "skip"],
    ["404 before the flag is read", missing, "unknown", "skip"],
    ["a saved profile", { status: "success", data: SAVED }, "notSkipped", "skip"],
    ["loading or offline", { status: "pending", data: undefined }, "notSkipped", "skip"],
    [
      "pending even if a stale null is there",
      { status: "pending", data: null },
      "notSkipped",
      "skip",
    ],
    ["error even if a stale null is there", { status: "error", data: null }, "notSkipped", "skip"],
    ["an error (500, unavailable)", { status: "error", data: undefined }, "notSkipped", "skip"],
  ] as const)("%s: %s", (_name, profile, skip, expected) => {
    expect(onboardingGate(profile, skip)).toBe(expected);
  });
});

describe("the stored flag of 'Pular'", () => {
  test("is read once, then follows the writes and tells its listeners", async () => {
    const store = createMemoryKeyValueStore();
    await store.setItem(ONBOARDING_SKIP_KEY, "1");
    const flag = createStoredOnboardingSkip(store);
    expect(flag.snapshot()).toBe("unknown");
    const heard: string[] = [];
    flag.subscribe(() => heard.push(flag.snapshot()));
    await Promise.resolve();
    await Promise.resolve();
    expect(flag.snapshot()).toBe("skipped");
    await flag.clear();
    expect(store.entries().has(ONBOARDING_SKIP_KEY)).toBe(false);
    expect(heard).toEqual(["skipped", "notSkipped"]);
  });

  test("a store that fails reads as not skipped", async () => {
    const broken = {
      ...createMemoryKeyValueStore(),
      getItem: () => Promise.reject(new Error("closed")),
    };
    const flag = createStoredOnboardingSkip(broken);
    await Promise.resolve();
    await Promise.resolve();
    expect(flag.snapshot()).toBe("notSkipped");
  });
});
