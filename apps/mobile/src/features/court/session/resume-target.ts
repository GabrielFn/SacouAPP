import type { CourtRouteParams } from "../navigation";
import type { ResumeOnce } from "./resume-once";

/** Where the home sends the user when the app opens: the court in progress, once, or nowhere. */
export function takeResumeTarget(resume: ResumeOnce): CourtRouteParams | null {
  const courtSessionId = resume.take();
  return courtSessionId === null ? null : { courtSessionId };
}
