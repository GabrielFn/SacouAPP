import { useRouter } from "expo-router";

import { strings } from "../../../strings/pt-BR";
import { Button } from "../../../ui/Button";
import { StatusPill } from "../../../ui/StatusPill";
import { summaryHref } from "../navigation";

const { detail, cards } = strings.rounds;

/** The "Encerrada" seal under the title of screens 06 and 26 once the round is over (R99, ADR 0077). */
export function EndedBadge() {
  return <StatusPill label={detail.ended} status="waiting" />;
}

export interface EndedFooterProps {
  readonly groupId: string;
  readonly roundId: string;
}

/** The only action of a round that is over: "Ver resumo", which opens the summary (12). */
export function EndedFooter({ groupId, roundId }: EndedFooterProps) {
  const router = useRouter();
  return (
    <Button
      label={cards.seeSummary}
      onPress={() => {
        router.push(summaryHref(groupId, roundId));
      }}
    />
  );
}
