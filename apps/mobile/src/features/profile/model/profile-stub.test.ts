import { describe, expect, test } from "vitest";

import type { MyProfile } from "../../../services/api/sacou-api";
import { ApiFailure } from "../../../services/api/api-error";
import {
  editProfileView,
  loadFailureText,
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

describe("loadFailureText", () => {
  const offline = new ApiFailure({ kind: "offline" });
  test.each<[unknown, "fetching" | "paused" | "idle", string]>([
    [offline, "idle", "Sem conexão."],
    [null, "paused", "Sem conexão."],
    [
      new ApiFailure({ kind: "unavailable" }),
      "idle",
      "O Sacou está fora do ar por um instante. Tentando de novo.",
    ],
    [new Error("boom"), "idle", "Algo deu errado. Tente de novo daqui a pouco."],
    [null, "idle", "Algo deu errado. Tente de novo daqui a pouco."],
  ])("%s with %s reads %s", (error, fetchStatus, expected) => {
    expect(loadFailureText({ error, fetchStatus })).toBe(expected);
  });
});
