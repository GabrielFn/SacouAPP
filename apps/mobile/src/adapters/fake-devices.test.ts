import { describe, expect, test } from "vitest";

import { createFakeBackGuard } from "./fake-back-guard";
import { createFakeClock } from "./fake-clock";
import { createFakeCourtFeedback } from "./fake-court-feedback";
import { createFakeReducedMotion } from "./fake-reduced-motion";
import { createFakeScreenAwake } from "./fake-screen-awake";

describe("the fakes keep the contract of the ports", () => {
  test("the screen stays awake from activate to deactivate, with the same tag", () => {
    const awake = createFakeScreenAwake();
    awake.activate("court");
    expect(awake.active()).toEqual(["court"]);
    awake.deactivate("court");
    expect(awake.active()).toEqual([]);
    expect(awake.calls()).toEqual(["activate:court", "deactivate:court"]);
  });

  test("the back button is blocked until the release is called, once", () => {
    const guard = createFakeBackGuard();
    const release = guard.block();
    expect(guard.isBlocking()).toBe(true);
    release();
    release();
    expect(guard.isBlocking()).toBe(false);
  });

  test("the feedback is recorded in order", () => {
    const feedback = createFakeCourtFeedback();
    feedback.play("point");
    feedback.play("refused");
    expect(feedback.played()).toEqual(["point", "refused"]);
  });

  test("the clock moves only when told to", () => {
    const clock = createFakeClock(5);
    clock.advance(10);
    expect(clock.now()).toBe(15);
    clock.set(2);
    expect(clock.now()).toBe(2);
  });

  test("reduced motion tells the listeners when it changes, until they stop listening", () => {
    const motion = createFakeReducedMotion();
    const heard: boolean[] = [];
    const stop = motion.subscribe(() => {
      heard.push(motion.getSnapshot());
    });
    motion.set(true);
    stop();
    motion.set(false);
    expect(heard).toEqual([true]);
  });
});
