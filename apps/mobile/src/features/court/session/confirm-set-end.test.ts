import { err, ok } from "@sacou/volley-rules";
import { describe, expect, test, vi } from "vitest";

import { createFakeCourtFeedback } from "../../../adapters/fake-court-feedback";
import type { PlayCommand } from "./command-drafts";
import type { CommandResult } from "./court-session-controller";
import { confirmSetEnd } from "./confirm-set-end";

function run(result: CommandResult, firstServer?: "a" | "b") {
  const feedback = createFakeCourtFeedback();
  const dispatch = vi.fn<(command: PlayCommand) => Promise<CommandResult>>(() =>
    Promise.resolve(result),
  );
  return confirmSetEnd({ dispatch, feedback }, firstServer).then(() => ({ dispatch, feedback }));
}

describe("confirming the end of the set", () => {
  test("a confirmation that goes through does not buzz", async () => {
    const { dispatch, feedback } = await run(ok(undefined));
    expect(dispatch).toHaveBeenCalledWith({ type: "confirm-set-end" });
    expect(feedback.played()).toEqual([]);
  });

  test("a refused confirmation buzzes refused, once", async () => {
    const { feedback } = await run(err({ code: "refused", reason: "no-open-set" }));
    expect(feedback.played()).toEqual(["refused"]);
  });

  test("a failed write also buzzes refused", async () => {
    const { feedback } = await run(err({ code: "not-ready" }));
    expect(feedback.played()).toEqual(["refused"]);
  });

  test("the toss of the deciding set goes in the command", async () => {
    const { dispatch } = await run(ok(undefined), "b");
    expect(dispatch).toHaveBeenCalledWith({ type: "confirm-set-end", firstServer: "b" });
  });
});
