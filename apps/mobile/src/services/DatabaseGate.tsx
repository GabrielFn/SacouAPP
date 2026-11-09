import { useEffect, useState, type ReactNode } from "react";

import { CourtRuntimeProvider } from "../features/court/hooks/court-runtime-context";
import { ResumeProvider } from "../features/court/hooks/resume-context";
import type { CourtRuntime, CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import { findResumableCourtSession } from "../features/court/session/resume-court";
import { createResumeOnce, type ResumeOnce } from "../features/court/session/resume-once";
import { strings } from "../strings/pt-BR";
import { ErrorScreen } from "../ui/ErrorScreen";
import { useServices } from "./services-context";

type GateState =
  | { readonly status: "opening" }
  | { readonly status: "ready"; readonly runtime: CourtRuntime; readonly resume: ResumeOnce }
  | { readonly status: "failed" };

export interface DatabaseGateProps {
  readonly children: ReactNode;
}

async function openRuntime(opener: CourtRuntimeOpener): Promise<GateState> {
  const opened = await opener.open();
  if (!opened.ok) {
    return { status: "failed" };
  }
  // Decided here, once per opening of the app, together with the database.
  const resumable = await findResumableCourtSession(opened.value);
  return { status: "ready", runtime: opened.value, resume: createResumeOnce(resumable) };
}

/** Waits for the local database to open and migrate before any route shows (like the font gate). */
export function DatabaseGate({ children }: DatabaseGateProps) {
  const { courtRuntimeOpener } = useServices();
  const [state, setState] = useState<GateState>({ status: "opening" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const alive = { current: true };
    void openRuntime(courtRuntimeOpener).then((next) => {
      if (alive.current) {
        setState(next);
      }
    });
    return () => {
      alive.current = false;
    };
  }, [courtRuntimeOpener, attempt]);
  if (state.status === "opening") {
    return null;
  }
  if (state.status === "failed") {
    return (
      <ErrorScreen
        title={strings.court.storageError.title}
        body={strings.court.storageError.body}
        actions={[
          {
            label: strings.court.error.retry,
            onPress: () => {
              // Shows the opening state again while the new attempt runs.
              setState({ status: "opening" });
              setAttempt((count) => count + 1);
            },
          },
        ]}
      />
    );
  }
  return (
    <CourtRuntimeProvider runtime={state.runtime}>
      <ResumeProvider resume={state.resume}>{children}</ResumeProvider>
    </CourtRuntimeProvider>
  );
}
