import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { addedText } from "../model/addable-members";
import { setMemberAttendanceMutation } from "../queries/round-mutations";
import { useRound } from "../queries/use-round-queries";

export interface AddPlayerModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly round: ReturnType<typeof useRound>;
  readonly members: ReturnType<typeof useGroupMembers>;
  /** The text of the search, the only state of the screen (frontend.md, rule 4: one field). */
  readonly search: string;
  readonly setSearch: (text: string) => void;
  readonly add: (memberId: string) => void;
  /** The member whose "Adicionar" is on the way, `null` when none. */
  readonly addingId: string | null;
  /** "Davi entrou na espera (2º)." after the last one; the error text when it was refused. */
  readonly feedback: string | null;
  readonly failed: boolean;
}

/** The queries and the call of screen 21; the screen only draws. */
export function useAddPlayer(groupId: string, roundId: string): AddPlayerModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const [search, setSearch] = useState("");
  const mutation = useMutation(setMemberAttendanceMutation(sacouApi, client, groupId, roundId));
  const feedback = mutation.isError
    ? errorTextOf(mutation.error)
    : mutation.data === undefined
      ? null
      : addedText(mutation.data, members.data ?? []);
  return {
    group,
    round,
    members,
    search,
    setSearch,
    add: (memberId) => {
      if (!mutation.isPending) mutation.mutate({ memberId, response: "going" });
    },
    addingId: mutation.isPending ? (mutation.variables?.memberId ?? null) : null,
    feedback,
    failed: mutation.isError,
  };
}
