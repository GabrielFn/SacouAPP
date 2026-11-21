import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { mvpVoteHref, roundHref } from "../../rounds/navigation";
import { useRoundSummary } from "../hooks/use-round-summary";
import type { ReadySummary, SummaryView, TeamsHighlights } from "../model/summary-view";
import { HighlightCard } from "./HighlightCard";
import { MvpHeroCard } from "./MvpHeroCard";
import { RankingList } from "./RankingList";
import { ShareBlock } from "./ShareBlock";
import { VotingEntry } from "./VotingEntry";

const { summary } = strings;

export interface RoundSummaryScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

export interface SummaryBodyProps {
  readonly ready: ReadySummary;
  readonly onShare: () => void;
  readonly onVote: () => void;
}

export interface TeamCardsProps {
  readonly highlights: TeamsHighlights;
}

function TeamCards({ highlights }: TeamCardsProps) {
  const { tokens } = useTheme();
  const cards = [highlights.mostWins, highlights.longestStreak].filter(
    (highlight) => highlight !== null,
  );
  return cards.length === 0 ? null : (
    <View style={{ flexDirection: "row", gap: tokens.spacing.s10 }}>
      {cards.map((highlight) => (
        <HighlightCard key={highlight.title} highlight={highlight} />
      ))}
    </View>
  );
}

function SummaryBody({ ready, onShare, onVote }: SummaryBodyProps) {
  const { tokens } = useTheme();
  const { mvp, highlights, stale, unsentNote } = ready;
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {stale ? <Text variant="muted">{summary.staleNote}</Text> : null}
      {unsentNote === null ? null : (
        <Text variant="muted" accessibilityRole="alert">
          {unsentNote}
        </Text>
      )}
      {mvp === null ? null : <MvpHeroCard name={mvp.name} line={mvp.line} notes={mvp.notes} />}
      <VotingEntry entry={ready.voting} onVote={onVote} />
      {highlights.kind === "ranking" ? (
        <RankingList rows={highlights.rows} />
      ) : (
        <TeamCards highlights={highlights} />
      )}
      <ShareBlock onShare={onShare} />
    </View>
  );
}

function headerOf(view: SummaryView): string {
  return view.kind === "ready" || view.kind === "empty" ? view.header : "";
}

export interface SummaryContentProps {
  readonly view: SummaryView;
  readonly retry: () => void;
  readonly onShare: () => void;
  readonly onVote: () => void;
}

function SummaryContent({ view, retry, onShare, onVote }: SummaryContentProps) {
  const retryAction = { label: summary.retry, variant: "secondary" as const, onPress: retry };
  switch (view.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={summary.loading} />;
    case "offline-empty":
      return (
        <EmptyState
          title={summary.offlineTitle}
          body={summary.offlineBody}
          actions={[retryAction]}
        />
      );
    case "error":
      return (
        <EmptyState alert title={summary.errorTitle} body={view.text} actions={[retryAction]} />
      );
    case "empty":
      return (
        <>
          {view.unsentNote === null ? null : (
            <Text variant="muted" accessibilityRole="alert">
              {view.unsentNote}
            </Text>
          )}
          <EmptyState title={summary.emptyTitle} />
        </>
      );
    case "ready":
      return <SummaryBody ready={view} onShare={onShare} onVote={onVote} />;
  }
}

/** Screen 12: the numbers of the round, read from the server and only formatted here. */
export function RoundSummaryScreen({ groupId, roundId }: RoundSummaryScreenProps) {
  const { view, retry, share } = useRoundSummary(groupId, roundId);
  const { tokens } = useTheme();
  const router = useRouter();
  return (
    <Screen scroll>
      <View style={{ gap: tokens.spacing.xs }}>
        <BackBar title={headerOf(view)} fallbackHref={roundHref(groupId, roundId)} />
        <Text variant="display" displaySize="summaryTitle" accessibilityRole="header">
          {summary.title}
        </Text>
      </View>
      <SummaryContent
        view={view}
        retry={retry}
        onShare={share}
        onVote={() => {
          router.push(mvpVoteHref(groupId, roundId));
        }}
      />
    </Screen>
  );
}
