import { createContext, useContext, type ReactNode } from "react";

import type { ResumeOnce } from "../session/resume-once";

const ResumeContext = createContext<ResumeOnce | null>(null);

export interface ResumeProviderProps {
  readonly resume: ResumeOnce;
  readonly children: ReactNode;
}

export function ResumeProvider({ resume, children }: ResumeProviderProps) {
  return <ResumeContext.Provider value={resume}>{children}</ResumeContext.Provider>;
}

export function useResumeOnce(): ResumeOnce {
  const resume = useContext(ResumeContext);
  if (!resume) throw new Error("ResumeProvider is missing from the tree.");
  return resume;
}
