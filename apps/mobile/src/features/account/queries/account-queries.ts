import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import type { AuthProvider } from "../../../services/auth/auth-session";
import type { FileShare } from "../../../services/share/file-share";
import {
  deleteAccount,
  type DeletionDeps,
  type DeletionOutcome,
} from "../model/delete-account-flow";
import { exportMyData } from "../model/export-data";
import type { PasswordHandoff } from "../model/password-handoff";
import type { SingleFlight } from "../model/single-flight";

/**
 * The preview of screen 30b: always read again (a role may have changed on another phone) and gone
 * when the screen closes. Under `["me"]`, so never persisted.
 */
export function deletionBlockersQuery(api: SacouApi) {
  return queryOptions({
    queryKey: queryKeys.deletionBlockers(),
    queryFn: () => unwrap(api.getDeletionBlockers()),
    staleTime: 0,
    gcTime: 0,
  });
}

export function refreshDeletionBlockers(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.deletionBlockers() });
}

export interface ExportMutationDeps {
  readonly api: SacouApi;
  readonly fileShare: FileShare;
  readonly now: () => Date;
}

/**
 * "Gerar arquivo". The document never reaches the mutation's state: the result is only ok or the kind
 * of the failure, and it is dropped as soon as the sheet closes (`gcTime: 0`).
 */
export function exportDataMutation(deps: ExportMutationDeps) {
  return {
    scope: { id: "export-my-data" },
    gcTime: 0,
    mutationFn: () => exportMyData(deps),
  };
}

export interface DeleteMutationDeps {
  readonly deletion: DeletionDeps;
  readonly provider: AuthProvider;
  readonly password: PasswordHandoff;
  readonly flight: SingleFlight<DeletionOutcome>;
}

/**
 * "Excluir minha conta". No variables: the password comes through the handoff and is taken at once, so
 * the mutation's state never holds it; the outcome holds kinds and codes only (`gcTime: 0`).
 */
export function deleteAccountMutation({
  deletion,
  provider,
  password,
  flight,
}: DeleteMutationDeps) {
  return {
    scope: { id: "delete-my-account" },
    gcTime: 0,
    mutationFn: () => {
      const typed = password.take();
      return flight.run(() => deleteAccount(deletion, { provider, password: typed }));
    },
  };
}
