import { describe, expect, test } from "vitest";

import type { MyProfile } from "../../../services/api/sacou-api";
import {
  editProfileView,
  greetingNicknameOf,
  isProfileStub,
  type EditProfileQueryView,
  type ProfileStub,
} from "./profile-stub";

const FULL: MyProfile = {
  nickname: "Ana",
  primaryPosition: "setter",
  otherPositions: [],
  suggestedLevel: 4,
};
const STUB: ProfileStub = { nickname: "Ana" };

describe("greetingNicknameOf", () => {
  test.each([
    [undefined, null],
    [null, null],
    [FULL, "Ana"],
    [STUB, "Ana"],
  ])("%o gives %s", (profile, expected) => {
    expect(greetingNicknameOf(profile)).toBe(expected);
  });
});

describe("isProfileStub", () => {
  test("only the nickname restored from disk is a stub", () => {
    expect(isProfileStub(FULL)).toBe(false);
    expect(isProfileStub(STUB)).toBe(true);
  });
});

describe("editProfileView", () => {
  test.each<[EditProfileQueryView, string]>([
    [{ status: "pending", fetchStatus: "fetching", data: undefined }, "loading"],
    [{ status: "pending", fetchStatus: "paused", data: undefined }, "loading"],
    [{ status: "error", fetchStatus: "idle", data: undefined }, "error"],
    [{ status: "success", fetchStatus: "fetching", data: STUB }, "loading"],
    [{ status: "success", fetchStatus: "paused", data: STUB }, "error"],
    [{ status: "success", fetchStatus: "idle", data: STUB }, "error"],
    [{ status: "success", fetchStatus: "idle", data: FULL }, "form"],
    [{ status: "success", fetchStatus: "fetching", data: FULL }, "form"],
    [{ status: "success", fetchStatus: "idle", data: null }, "form"],
  ])("%o shows %s", (query, expected) => {
    expect(editProfileView(query)).toBe(expected);
  });
});
