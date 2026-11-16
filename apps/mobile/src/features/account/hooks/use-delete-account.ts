import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducer, useRef } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { AuthProvider } from "../../../services/auth/auth-session";
import { useServices } from "../../../services/services-context";
import {
  asksForPassword,
  deleteAccount,
  deletionOutcomeText,
  type DeletionOutcome,
} from "../model/delete-account-flow";
import {
  deleteAccountReducer,
  initialDeleteAccountState,
  type DeleteAccountState,
} from "../model/delete-account.reducer";
import { blockerNotice, canDelete, type BlockerNotice } from "../model/delete-account.selectors";
import { createSingleFlight } from "../model/single-flight";
import { deletionBlockersQuery, refreshDeletionBlockers } from "../queries/account-queries";

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
  const client = useQueryClient();
  const [state, dispatch] = useReducer(deleteAccountReducer, initialDeleteAccountState);
  const blockers = useQuery(deletionBlockersQuery(sacouApi));
  // Not state: it only closes the window of a second tap in the same frame (see single-flight.ts).
  const flight = useRef(createSingleFlight<DeletionOutcome>());
  const deletion = useMutation({
    scope: { id: "delete-my-account" },
    gcTime: 0,
    mutationFn: (password: string | null) =>
      flight.current.run(() =>
        deleteAccount(
          {
            api: sacouApi,
            auth: authSession,
            ender: sessionEnder,
            refreshBlockers: () => refreshDeletionBlockers(client),
          },
          { provider, password },
        ),
      ),
  });
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
      const password = asks ? state.password : null;
      if (asks) dispatch({ type: "password-sent" });
      deletion.mutate(password);
    },
  };
}
