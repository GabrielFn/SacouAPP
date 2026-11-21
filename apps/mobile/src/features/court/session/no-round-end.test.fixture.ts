import type { RoundEndLookup } from "../ports/round-end-lookup";

/** For the tests of the resume before R97: no round end known, so it resumes as before (D4). */
export const NO_ROUND_END: { readonly rounds: RoundEndLookup; readonly now: number } = {
  rounds: { endOf: () => ({ kind: "unknown" }) },
  now: 0,
};
