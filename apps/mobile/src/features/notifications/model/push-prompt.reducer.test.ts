import { describe, expect, test } from "vitest";

import {
  INITIAL_PUSH_PROMPT,
  pushPromptReducer,
  showsPushPrompt,
  type PushPromptAction,
  type PushPromptState,
} from "./push-prompt.reducer";

const STATES: readonly PushPromptState[] = ["idle", "checking", "offering", "asking", "done"];

function run(actions: readonly PushPromptAction[]): PushPromptState {
  return actions.reduce(pushPromptReducer, INITIAL_PUSH_PROMPT);
}

describe("R98 item 9: the offer of the notifications", () => {
  test("a first VOU, due: the sentence, then the system question, then over", () => {
    expect(run([{ type: "offer-requested" }])).toBe("checking");
    expect(run([{ type: "offer-requested" }, { type: "checked", due: true }])).toBe("offering");
    const asked = run([
      { type: "offer-requested" },
      { type: "checked", due: true },
      { type: "accepted" },
    ]);
    expect(asked).toBe("asking");
    expect(pushPromptReducer(asked, { type: "answered" })).toBe("done");
  });

  test("not due (given, refused for good or already offered): straight to over", () => {
    expect(run([{ type: "offer-requested" }, { type: "checked", due: false }])).toBe("done");
  });

  test("Agora nao ends it, and a second VOU in the same run never shows it again", () => {
    const declined = run([
      { type: "offer-requested" },
      { type: "checked", due: true },
      { type: "declined" },
    ]);
    expect(declined).toBe("done");
    expect(pushPromptReducer(declined, { type: "offer-requested" })).toBe("done");
  });

  test("a second offer while one runs is ignored: one sentence, one question", () => {
    for (const state of ["checking", "offering", "asking"] as const) {
      expect(pushPromptReducer(state, { type: "offer-requested" })).toBe(state);
    }
  });

  test("actions out of their place change nothing", () => {
    expect(pushPromptReducer("idle", { type: "checked", due: true })).toBe("idle");
    expect(pushPromptReducer("idle", { type: "accepted" })).toBe("idle");
    expect(pushPromptReducer("checking", { type: "declined" })).toBe("checking");
    expect(pushPromptReducer("offering", { type: "answered" })).toBe("offering");
    expect(pushPromptReducer("done", { type: "accepted" })).toBe("done");
  });

  test("the sentence shows only while offering", () => {
    expect(STATES.filter(showsPushPrompt)).toEqual(["offering"]);
  });
});
