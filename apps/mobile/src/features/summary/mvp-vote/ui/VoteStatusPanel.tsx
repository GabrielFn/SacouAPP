import { mvpVoteStrings as texts } from "../../../../strings/mvp-vote.pt-BR";
import { EmptyState } from "../../../../ui/EmptyState";
import { LoadingState } from "../../../../ui/LoadingState";
import type { MvpVoteBody } from "../model/mvp-vote-view";

export type StatusBody = Exclude<MvpVoteBody, { readonly kind: "choosing" }>;

export interface VoteStatusPanelProps {
  readonly body: StatusBody;
  readonly onRetry: () => void;
  readonly onSeeSummary: () => void;
}

/** The states of screen 12a without the ballot: nobody's vote and no count is ever in them. */
export function VoteStatusPanel({ body, onRetry, onSeeSummary }: VoteStatusPanelProps) {
  const retry = { label: texts.retry, variant: "secondary" as const, onPress: onRetry };
  const summary = { label: texts.seeSummary, variant: "outline" as const, onPress: onSeeSummary };
  switch (body.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={texts.loading} />;
    case "offline-empty":
      return <EmptyState title={texts.offlineTitle} body={texts.offlineBody} actions={[retry]} />;
    case "error":
      return <EmptyState alert title={texts.errorTitle} body={body.text} actions={[retry]} />;
    case "voting-off":
      return <EmptyState title={texts.votingOff} actions={[summary]} />;
    case "not-open":
      return <EmptyState title={texts.notOpen} body={body.opensAt} actions={[summary]} />;
    case "not-eligible":
      return (
        <EmptyState
          title={texts.notEligible}
          body={texts.closesIn(body.closesIn)}
          actions={[summary]}
        />
      );
    case "already-voted":
      return <EmptyState title={body.voted} body={body.result} actions={[summary]} />;
    case "closed":
      return <EmptyState title={texts.closed} body={texts.closedBody} actions={[summary]} />;
  }
}
