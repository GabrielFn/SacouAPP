import { describe, expect, test } from "vitest";

import { createPromptLifetime } from "./push-prompt";
import type { PushPromptAction } from "./push-prompt.reducer";

describe("R98 Part 3b: the lifetime of the offer inside one session", () => {
  test("stop cancels the held retry once, and the cancel runs at once if already stopped", () => {
    const life = createPromptLifetime();
    const calls = { n: 0 };
    life.hold(() => {
      calls.n += 1;
    });
    life.stop();
    life.stop();
    expect(calls.n).toBe(1);
    life.hold(() => {
      calls.n += 1;
    });
    expect(calls.n).toBe(2);
  });

  test("a answer arriving after stop (signed out) is ignored", () => {
    const life = createPromptLifetime();
    const sent: PushPromptAction[] = [];
    const send = life.guarded((a) => sent.push(a));
    send({ type: "checked", due: true });
    life.stop();
    send({ type: "checked", due: true });
    expect(sent).toHaveLength(1);
  });
});
