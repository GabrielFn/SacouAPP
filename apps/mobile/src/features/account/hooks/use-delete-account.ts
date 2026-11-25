import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { AuthProvider } from "../../../services/auth/auth-session";
import { useServices } from "../../../services/services-context";
import { useCourtRuntime } from "../../court/hooks/court-runtime-context";
import {
  asksForPassword,
  deletionOutcomeText,
  type DeletionOutcome,
} from "../model/delete-account-flow";
import {
  deleteAccountReducer,
  initialDeleteAccountState,
  type DeleteAccountState,
} from "../model/delete-account.reducer";
import { blockerNotice, canDelete, type BlockerNotice } from "../model/delete-account.selectors";
import { createPasswordHandoff } from "../model/password-handoff";
import { createSingleFlight } from "../model/single-flight";
import {
  deleteAccountMutation,
  deletionBlockersQuery,
  refreshDeletionBlockers,
} from "../queries/account-queries";

export interface DeleteAccountModel {
  readonly state: DeleteAccountState;
  readonly notice: BlockerNotice | null;
  /** The preview failed (offline, 5xx): its text and "Tentar de novo". */
  readonly blockersError: string | null;
  readonly asksForPassword: boolean;
  readonly canDelete: boolean;
  readonly pending: boolean;
  readonly message: string | null;
  readonly changeConfirm: (text: string) => void;
  readonly changePassword: (text: string) => void;
  readonly retryBlockers: () => void;
  readonly submit: () => void;
}

/** Screen 30b: the preview of the blockers, what is typed, and the one deletion in flight. */
export function useDeleteAccount(provider: AuthProvider): DeleteAccountModel {
  const { sacouApi, authSession, sessionEnder } = useServices();
  // Screen 30b is inside the DatabaseGate: the log of the court is open (E6.8).
  const { log } = useCourtRuntime();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(deleteAccountReducer, initialDeleteAccountState);
  const blockers = useQuery(deletionBlockersQuery(sacouApi));
  // Never changed, only kept across renders (a lazy `useState`, since a ref may not be read in render):
  // the single flight closes the window of a second tap in the same frame (see single-flight.ts), and
  // the handoff carries the password to the request without keeping it (see password-handoff.ts).
  const [flight] = useState(() => createSingleFlight<DeletionOutcome>());
  const [handoff] = useState(createPasswordHandoff);
  const deletion = useMutation(
    deleteAccountMutation({
      deletion: {
        api: sacouApi,
        auth: authSession,
        ender: sessionEnder,
        court: log,
        refreshBlockers: () => refreshDeletionBlockers(client),
      },
      provider,
      password: handoff,
      flight,
    }),
  );
  const asks = asksForPassword(provider, deletion.data);
  const ready = canDelete({
    confirmText: state.confirmText,
    blockers: blockers.data,
    pending: deletion.isPending,
    asksForPassword: asks,
    password: state.password,
  });
  return {
    state,
    notice: blockers.data === undefined ? null : blockerNotice(blockers.data),
    blockersError: blockers.isError ? errorTextOf(blockers.error) : null,
    asksForPassword: asks,
    canDelete: ready,
    pending: deletion.isPending,
    message: deletionOutcomeText(deletion.data),
    changeConfirm: (text) => {
      dispatch({ type: "confirm-changed", text });
    },
    changePassword: (text) => {
      dispatch({ type: "password-changed", text });
    },
    retryBlockers: () => {
      void blockers.refetch();
    },
    submit: () => {
      if (!ready) return;
      handoff.give(asks ? state.password : null);
      if (asks) dispatch({ type: "password-sent" });
      deletion.mutate();
    },
  };
}
