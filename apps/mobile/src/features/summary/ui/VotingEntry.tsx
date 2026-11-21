import { Text } from "../../../ui/Text";
import { Button } from "../../../ui/Button";
import type { VotingEntryView } from "../model/voting-entry";

export interface VotingEntryProps {
  readonly entry: VotingEntryView;
  readonly onVote: () => void;
}

/**
 * The way into the vote on screen 12 (question 170): a button while the person can vote, a line once
 * they did. It never shows the name voted nor a count of votes.
 */
export function VotingEntry({ entry, onVote }: VotingEntryProps) {
  switch (entry.kind) {
    case "hidden":
      return null;
    case "not-open":
      return <Text variant="muted">{entry.text}</Text>;
    case "voted":
      return <Text variant="bodyStrong">{entry.text}</Text>;
    case "vote":
      return <Button label={entry.label} onPress={onVote} />;
  }
}
