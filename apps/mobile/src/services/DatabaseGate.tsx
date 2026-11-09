import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";

import { CourtRuntimeProvider } from "../features/court/hooks/court-runtime-context";
import { ResumeProvider } from "../features/court/hooks/resume-context";
import type { CourtRuntime, CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import { findResumableCourtSession } from "../features/court/session/resume-court";
import { createResumeOnce, type ResumeOnce } from "../features/court/session/resume-once";
import { useTheme } from "../theme/theme-context";
import { strings } from "../strings/pt-BR";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
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
  const { tokens } = useTheme();
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
      <Screen>
        <View accessibilityRole="alert" style={{ gap: tokens.spacing.s }}>
          <Text variant="title">{strings.court.storageError.title}</Text>
          <Text variant="muted">{strings.court.storageError.body}</Text>
        </View>
        <Button
          label={strings.court.error.retry}
          onPress={() => {
            setAttempt((count) => count + 1);
          }}
        />
      </Screen>
    );
  }
  return (
    <CourtRuntimeProvider runtime={state.runtime}>
      <ResumeProvider resume={state.resume}>{children}</ResumeProvider>
    </CourtRuntimeProvider>
  );
}
