import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import { canReportGroup, reportBody, type ReportFlow } from "../model/report";
import { reportContentMutation } from "../queries/report-mutations";
import { useGroupMembers } from "../queries/use-group-queries";

/** "Denunciar grupo" on screen 18 (E6.6): who sees the line, the open sheet and the status of the call. */
export interface GroupReportModel extends ReportFlow {
  readonly canReport: boolean;
  readonly open: () => void;
  readonly close: () => void;
}

/** The sheet's one field is whether it is open (`useState`, frontend.md rule 4); the rest is the mutation's status. */
export function useGroupReport(groupId: string): GroupReportModel {
  const { sacouApi } = useServices();
  const members = useGroupMembers(groupId);
  const [opened, setOpened] = useState(false);
  const report = useMutation(reportContentMutation(sacouApi, groupId));
  return {
    canReport: canReportGroup(members.data),
    target: opened ? { kind: "group" } : null,
    pending: report.isPending,
    errorText: report.isError ? errorTextOf(report.error) : null,
    sent: report.isSuccess,
    open: () => {
      report.reset();
      setOpened(true);
    },
    close: () => {
      setOpened(false);
    },
    send: (reason) => {
      report.mutate(reportBody({ kind: "group" }, reason), {
        onSuccess: () => {
          setOpened(false);
        },
      });
    },
  };
}
