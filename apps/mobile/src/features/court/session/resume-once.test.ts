import { describe, expect, it } from "vitest";

import { createFakeCourtRuntime } from "../../../adapters/fake-court-runtime-opener";
import { startSampleMatch } from "../dev/start-sample-match";
import { findResumableCourtSession } from "./resume-court";
import { createResumeOnce } from "./resume-once";

describe("resuming the court once per opening of the app", () => {
  it("hands the session over the first time and never again", () => {
    const resume = createResumeOnce("c0000000-0000-4000-8000-0000000000a1");
    expect(resume.take()).toBe("c0000000-0000-4000-8000-0000000000a1");
    expect(resume.take()).toBeNull();
  });

  it("with nothing to resume it is always null", () => {
    expect(createResumeOnce(null).take()).toBeNull();
  });

  it("cold start, resume, leave the court: the home does not send the user back", async () => {
    const runtime = createFakeCourtRuntime();
    await startSampleMatch(runtime, "one-set");
    // The gate decides when the app opens...
    const resume = createResumeOnce(await findResumableCourtSession(runtime));
    // ...the first home takes the court; the home the user lands on after leaving finds nothing.
    expect(resume.take()).not.toBeNull();
    expect(resume.take()).toBeNull();
    expect(await findResumableCourtSession(runtime)).not.toBeNull();
  });
});
