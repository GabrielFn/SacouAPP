import { describe, expect, test } from "vitest";

import type { MyProfile } from "../../../services/api/sacou-api";
import { greetingNicknameOf, isProfileStub } from "./profile-stub";

const FULL: MyProfile = {
  nickname: "Ana",
  primaryPosition: "setter",
  otherPositions: [],
  suggestedLevel: 4,
};

describe("greetingNicknameOf", () => {
  test.each([
    [undefined, null],
    [null, null],
    [FULL, "Ana"],
    [{ nickname: "Ana" } as MyProfile, "Ana"],
  ])("%o gives %s", (profile, expected) => {
    expect(greetingNicknameOf(profile)).toBe(expected);
  });
});

describe("isProfileStub", () => {
  test("only the nickname restored from disk is a stub", () => {
    expect(isProfileStub(FULL)).toBe(false);
    expect(isProfileStub({ nickname: "Ana" } as MyProfile)).toBe(true);
  });
});
