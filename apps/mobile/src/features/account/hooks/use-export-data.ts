import { useMutation } from "@tanstack/react-query";

import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { exportFailureText } from "../model/export-data";
import { exportDataMutation } from "../queries/account-queries";

export interface ExportDataModel {
  readonly pending: boolean;
  /** The text of the last failure, or `null`. */
  readonly message: string | null;
  /** Generates the file and opens the share sheet; `onShared` when the sheet closed after sharing. */
  readonly generate: (onShared: () => void) => void;
}

/** Sheet 30a: one mutation per opening of the sheet, mounted only while it is open. */
export function useExportData(): ExportDataModel {
  const { sacouApi, fileShare } = useServices();
  const mutation = useMutation(
    exportDataMutation({ api: sacouApi, fileShare, now: () => new Date(wallClockNow()) }),
  );
  const result = mutation.data;
  return {
    pending: mutation.isPending,
    message: result === undefined || result.ok ? null : exportFailureText(result.error),
    generate(onShared) {
      if (mutation.isPending) return;
      mutation.mutate(undefined, {
        onSuccess: (outcome) => {
          if (outcome.ok) onShared();
        },
      });
    },
  };
}
