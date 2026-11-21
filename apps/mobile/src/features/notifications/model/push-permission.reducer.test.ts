import { describe, expect, test } from "vitest";

import type { PermissionAnswer } from "../ports/notification-permission";
import {
  activationOf,
  INITIAL_PUSH_PERMISSION,
  pushPermissionReducer,
  showsPermissionCard,
  type PushPermissionAction,
  type PushPermissionState,
} from "./push-permission.reducer";

const STATES: readonly PushPermissionState[] = ["unknown", "asking", "granted", "denied", "blocked"];
const ANSWERS: readonly PermissionAnswer[] = ["granted", "askable", "blocked"];
const FROM_ANSWER: Readonly<Record<PermissionAnswer, PushPermissionState>> = {
  granted: "granted",
  askable: "denied",
  blocked: "blocked",
};

describe("M1 the reducer of the permission, every action in every state", () => {
  test("starts unknown", () => {
    expect(INITIAL_PUSH_PERMISSION).toBe("unknown");
  });

  test.each(STATES.flatMap((state) => ANSWERS.map((answer) => [state, answer] as const)))(
    "status-read in %s with %s",
    (state, answer) => {
      const next = pushPermissionReducer(state, { type: "status-read", answer });
      expect(next).toBe(state === "asking" ? "asking" : FROM_ANSWER[answer]);
    },
  );

  test.each(STATES)("request-started in %s", (state) => {
    const next = pushPermissionReducer(state, { type: "request-started" });
    expect(next).toBe(state === "denied" ? "asking" : state);
  });

  test.each(STATES.flatMap((state) => ANSWERS.map((answer) => [state, answer] as const)))(
    "request-answered in %s with %s",
    (state, answer) => {
      const next = pushPermissionReducer(state, { type: "request-answered", answer });
      expect(next).toBe(state === "asking" ? FROM_ANSWER[answer] : state);
    },
  );

  test("the whole flow: read, ask, refuse for good, then the settings", () => {
    const actions: readonly PushPermissionAction[] = [
      { type: "status-read", answer: "askable" },
      { type: "request-started" },
      { type: "request-answered", answer: "blocked" },
    ];
    const end = actions.reduce(pushPermissionReducer, INITIAL_PUSH_PERMISSION);
    expect(end).toBe("blocked");
    expect(activationOf(end)).toBe("open-settings");
  });

  test("the input state is never changed (it is a string, and the reducer returns a new one)", () => {
    const state: PushPermissionState = "denied";
    pushPermissionReducer(state, { type: "request-started" });
    expect(state).toBe("denied");
  });
});

describe("M10 what Ativar does and when the card shows", () => {
  test.each([
    ["unknown", "none", false],
    ["asking", "none", true],
    ["granted", "none", false],
    ["denied", "request", true],
    ["blocked", "open-settings", true],
  ] as const)("%s: %s, card %s", (state, activation, card) => {
    expect(activationOf(state)).toBe(activation);
    expect(showsPermissionCard(state)).toBe(card);
  });
});
