import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";

import { CourtRuntimeProvider } from "../features/court/hooks/court-runtime-context";
import type { CourtRuntime, CourtRuntimeError } from "../features/court/ports/court-runtime";
import { strings } from "../strings/pt-BR";
import { Text } from "../ui/Text";
import { useServices } from "./services-context";

type GateState =
  | { readonly status: "opening" }
  | { readonly status: "ready"; readonly runtime: CourtRuntime }
  | { readonly status: "failed"; readonly error: CourtRuntimeError };

export interface DatabaseGateProps {
  readonly children: ReactNode;
}

/** Waits for the local database to open and migrate before any route shows (like the font gate). */
export function DatabaseGate({ children }: DatabaseGateProps) {
  const { courtRuntimeOpener } = useServices();
  const [state, setState] = useState<GateState>({ status: "opening" });
  useEffect(() => {
    const alive = { current: true };
    void courtRuntimeOpener.open().then((opened) => {
      if (alive.current) {
        setState(
          opened.ok
            ? { status: "ready", runtime: opened.value }
            : { status: "failed", error: opened.error },
        );
      }
    });
    return () => {
      alive.current = false;
    };
  }, [courtRuntimeOpener]);
  if (state.status === "opening") {
    return null;
  }
  if (state.status === "failed") {
    return (
      <View accessibilityRole="alert">
        <Text variant="title">{strings.court.error.title}</Text>
        <Text variant="muted">{strings.court.error.body}</Text>
      </View>
    );
  }
  return <CourtRuntimeProvider runtime={state.runtime}>{children}</CourtRuntimeProvider>;
}
