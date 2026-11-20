import { useRouter } from "expo-router";

import type { Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { Button } from "../../../ui/Button";
import { summaryAvailable } from "../model/round-detail";
import { summaryHref } from "../navigation";

export interface SummaryLinkProps {
  readonly groupId: string;
  readonly round: Round;
  readonly now: number;
}

/** "Resumo da rodada" on screens 06 and 26, once the round started (E4.12, question 152). */
export function SummaryLink({ groupId, round, now }: SummaryLinkProps) {
  const router = useRouter();
  if (!summaryAvailable(round, now)) return null;
  return (
    <Button
      label={strings.rounds.detail.summaryLink}
      variant="link"
      onPress={() => {
        router.push(summaryHref(groupId, round.roundId));
      }}
    />
  );
}
