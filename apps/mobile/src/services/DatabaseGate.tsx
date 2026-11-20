import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { CourtRuntimeProvider } from "../features/court/hooks/court-runtime-context";
import { CourtSyncProvider } from "../features/court/hooks/court-sync-context";
import { ResumeProvider } from "../features/court/hooks/resume-context";
import type { CourtRuntime, CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { CourtSync } from "../features/court/ports/court-sync";
import { courtAccountOf } from "../features/court/sync/court-account";
import { createCourtSyncRunner } from "../features/court/sync/court-sync-runner";
import { findResumableCourtSession } from "../features/court/session/resume-court";
import { createResumeOnce, type ResumeOnce } from "../features/court/session/resume-once";
import { strings } from "../strings/pt-BR";
import { ErrorScreen } from "../ui/ErrorScreen";
import { queryKeys } from "./query/query-keys";
import { useServices, type Services } from "./services-context";

type GateState =
  | { readonly status: "opening" }
  | {
      readonly status: "ready";
      readonly runtime: CourtRuntime;
      readonly sync: CourtSync;
      readonly resume: ResumeOnce;
    }
  | { readonly status: "failed" };

export interface DatabaseGateProps {
  readonly children: ReactNode;
}

type SyncServices = Pick<
  Services,
  | "sacouApi"
  | "authSession"
  | "networkStatus"
  | "appForeground"
  | "clock"
  | "scheduler"
  | "randomSource"
>;

/** The upload loop over the database just opened and the services of the app (ADR 0067, D3). */
function createSync(
  log: CourtRuntime["log"],
  services: SyncServices,
  client: QueryClient,
): CourtSync {
  return createCourtSyncRunner({
    log,
    api: services.sacouApi,
    account: courtAccountOf(services.authSession),
    network: services.networkStatus,
    foreground: services.appForeground,
    clock: services.clock,
    scheduler: services.scheduler,
    random: services.randomSource,
    // The server has new points of the round: its summary is read again (E4.12).
    onAcknowledged: ({ groupId, roundId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
    },
  });
}

async function openRuntime(
  opener: CourtRuntimeOpener,
  services: SyncServices,
  client: QueryClient,
): Promise<GateState> {
  const opened = await opener.open();
  if (!opened.ok) {
    return { status: "failed" };
  }
  const sync = createSync(opened.value.log, services, client);
  const runtime: CourtRuntime = { ...opened.value, sync };
  // Decided here, once per opening of the app, together with the database.
  const resumable = await findResumableCourtSession(runtime);
  return { status: "ready", runtime, sync, resume: createResumeOnce(resumable) };
}

/** Waits for the local database to open and migrate before any route shows (like the font gate). */
export function DatabaseGate({ children }: DatabaseGateProps) {
  const services = useServices();
  const { courtRuntimeOpener } = services;
  const client = useQueryClient();
  const [state, setState] = useState<GateState>({ status: "opening" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const alive = { current: true };
    void openRuntime(courtRuntimeOpener, services, client).then((next) => {
      if (alive.current) {
        setState(next);
      }
    });
    return () => {
      alive.current = false;
    };
  }, [courtRuntimeOpener, services, client, attempt]);
  const sync = state.status === "ready" ? state.sync : null;
  // The loop runs while the database is open; it sends on its own, also the sessions already closed.
  useEffect(() => {
    sync?.start();
    return () => {
      sync?.stop();
    };
  }, [sync]);
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
      <CourtSyncProvider sync={state.sync}>
        <ResumeProvider resume={state.resume}>{children}</ResumeProvider>
      </CourtSyncProvider>
    </CourtRuntimeProvider>
  );
}
