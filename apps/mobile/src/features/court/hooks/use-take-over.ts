import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { Member } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { useGroupMembers } from "../../groups/queries/use-group-queries";
import { courtHref } from "../navigation";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { courtAccountOf } from "../sync/court-account";
import { waitOn, type CourtSummaryLookup } from "../takeover/court-summary-lookup";
import { runTakeover } from "../takeover/run-takeover";
import {
  INITIAL_TAKEOVER_STATE,
  takeoverReducer,
  type TakeoverAction,
  type TakeoverState,
} from "../takeover/takeover.reducer";
import { useCourtRuntime } from "./court-runtime-context";
import { useCourtSummaryLookup } from "./use-court-summary-lookup";

export interface TakeOverModel {
  /** `undefined` while the first summary is read. */
  readonly lookup: CourtSummaryLookup | undefined;
  /** The summary is being read again (after "O placar mudou"): the button waits for it. */
  readonly refreshing: boolean;
  readonly members: readonly Member[] | undefined;
  readonly state: TakeoverState;
  readonly confirm: () => void;
  readonly retry: () => void;
  /** "Voltar" closes the 09a (answer 82): nothing was taken over. */
  readonly close: () => void;
}

/**
 * Screen 09a (D5): the summary in the query cache, the flow in the reducer, the calls in `runTakeover`.
 * The court opens only after the import is kept (`done`), so it is never mounted while importing.
 */
export function useTakeOver(origin: CourtSessionOrigin): TakeOverModel {
  const { sacouApi, scheduler, authSession } = useServices();
  const { log, replayer } = useCourtRuntime();
  const router = useRouter();
  const summary = useCourtSummaryLookup(origin, true);
  const members = useGroupMembers(origin.groupId).data;
  const [state, dispatch] = useReducer(takeoverReducer, INITIAL_TAKEOVER_STATE);
  const deps = useMemo(
    () => ({
      api: sacouApi,
      log,
      replayer,
      wait: waitOn(scheduler),
      account: () => courtAccountOf(authSession).current(),
    }),
    [sacouApi, log, replayer, scheduler, authSession],
  );
  const { refresh } = summary;
  const report = useCallback(
    (action: TakeoverAction) => {
      dispatch(action);
      // The stream moved under the 09a: it shows the new summary before a second tap (E3.8, D2).
      if (action.type === "stream-changed") void refresh();
    },
    [refresh],
  );
  const { lookup } = summary;
  const confirm = useCallback(() => {
    if (lookup?.status !== "found" || state.status !== "confirming" || summary.fetching) return;
    dispatch({ type: "confirmed" });
    void runTakeover(deps, { origin, summary: lookup.summary }, report);
  }, [lookup, state.status, summary.fetching, deps, origin, report]);
  const retry = useCallback(() => {
    dispatch({ type: "retried" });
    void refresh();
  }, [refresh]);
  const done = state.status === "done" ? state.courtSessionId : null;
  useEffect(() => {
    // Back to the court under the 09a when there is one (09b), in its place otherwise (06, 08).
    if (done !== null) router.dismissTo(courtHref("court", { courtSessionId: done }));
  }, [done, router]);
  const close = useCallback(() => {
    router.back();
  }, [router]);
  return {
    lookup,
    refreshing: summary.fetching,
    members,
    state,
    confirm,
    retry,
    close,
  };
}
