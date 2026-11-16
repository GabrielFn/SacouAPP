import type { Result } from "@sacou/volley-rules";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { exportFailureText, type ExportFailure } from "../model/export-data";
import { createSingleFlight } from "../model/single-flight";
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
  // Kept across renders: a second tap in the same frame joins the first run (see single-flight.ts),
  // since `isPending` is seen only on the next render.
  const [flight] = useState(() => createSingleFlight<Result<null, ExportFailure>>());
  const mutation = useMutation(
    exportDataMutation({ api: sacouApi, fileShare, now: () => new Date(wallClockNow()) }, flight),
  );
  const result = mutation.data;
  return {
    pending: mutation.isPending,
    message: result === undefined || result.ok ? null : exportFailureText(result.error),
    generate(onShared) {
      mutation.mutate(undefined, {
        onSuccess: (outcome) => {
          if (outcome.ok) onShared();
        },
      });
    },
  };
}
