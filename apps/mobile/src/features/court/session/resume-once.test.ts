import { describe, expect, it } from "vitest";

import { createFakeCourtRuntime } from "../../../adapters/fake-court-runtime-opener";
import { startSampleMatch } from "../dev/start-sample-match";
import { findResumableCourtSession } from "./resume-court";
import { createResumeOnce } from "./resume-once";
import { takeResumeTarget } from "./resume-target";

describe("resuming the court once per opening of the app", () => {
  it("hands the session over the first time and never again", () => {
    const resume = createResumeOnce("c0000000-0000-4000-8000-0000000000a1");
    expect(resume.take()).toBe("c0000000-0000-4000-8000-0000000000a1");
    expect(resume.take()).toBeNull();
  });

  it("with nothing to resume it is always null", () => {
    expect(createResumeOnce(null).take()).toBeNull();
  });

  it("open, home, leave, new home: the court is resumed once and not again", async () => {
    const runtime = createFakeCourtRuntime();
    const started = await startSampleMatch(runtime, "one-set");
    if (!started.ok) throw new Error("did not start");
    // The gate decides when the app opens...
    const resume = createResumeOnce(await findResumableCourtSession(runtime));
    // ...the first home sends the user to the court...
    expect(takeResumeTarget(resume)).toEqual({ courtSessionId: started.value.courtSessionId });
    // ...and the home the user lands on after "Sair do modo quadra" finds nothing, though the
    // session is still open in the file.
    expect(takeResumeTarget(resume)).toBeNull();
    expect(await findResumableCourtSession(runtime)).toBe(started.value.courtSessionId);
  });
});
