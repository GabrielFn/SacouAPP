import { useRouter } from "expo-router";
import { View } from "react-native";

import { mvpVoteStrings as texts } from "../../../../strings/mvp-vote.pt-BR";
import { useTheme } from "../../../../theme/theme-context";
import { BackBar } from "../../../../ui/BackBar";
import { ErrorStrip } from "../../../../ui/ErrorStrip";
import { LockIcon } from "../../../../ui/Icons";
import { OfflineBanner } from "../../../../ui/OfflineBanner";
import { Screen } from "../../../../ui/Screen";
import { Text } from "../../../../ui/Text";
import { summaryHref } from "../../../rounds/navigation";
import { useMvpVote } from "../hooks/use-mvp-vote";
import type { ChoosingView } from "../model/mvp-vote-view";
import { BallotList } from "./BallotList";
import { VoteFooter } from "./VoteFooter";
import { VoteStatusPanel } from "./VoteStatusPanel";

export interface MvpVoteScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

export interface BallotBodyProps {
  readonly choosing: ChoosingView;
  readonly onSelect: (memberId: string) => void;
  readonly onDismissError: () => void;
}

function BallotBody({ choosing, onSelect, onDismissError }: BallotBodyProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {choosing.errorText === null ? null : (
        <ErrorStrip
          text={choosing.errorText}
          dismissLabel={texts.dismissError}
          onDismiss={onDismissError}
        />
      )}
      <BallotList rows={choosing.rows} disabled={choosing.submitting} onSelect={onSelect} />
      <Text variant="caption">{texts.rule}</Text>
    </View>
  );
}

/** Screen 12a: the secret vote for the MVP of the round (VotarMvp.dc.html). */
export function MvpVoteScreen({ groupId, roundId }: MvpVoteScreenProps) {
  const { header, view, select, submit, retry, dismissError } = useMvpVote(groupId, roundId);
  const { tokens } = useTheme();
  const router = useRouter();
  const { body } = view;
  const footer =
    body.kind === "choosing" ? (
      <VoteFooter
        label={body.footerLabel}
        enabled={body.canSubmit}
        submitting={body.submitting}
        onSubmit={submit}
      />
    ) : undefined;
  return (
    <Screen scroll footer={footer}>
      <View style={{ gap: tokens.spacing.xs }}>
        <BackBar title={header} fallbackHref={summaryHref(groupId, roundId)} />
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {texts.title}
        </Text>
        {body.kind === "choosing" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
            <LockIcon />
            <Text variant="muted">{body.deadline}</Text>
          </View>
        ) : null}
      </View>
      {view.stale ? <OfflineBanner text={texts.staleNote} /> : null}
      {body.kind === "choosing" ? (
        <BallotBody choosing={body} onSelect={select} onDismissError={dismissError} />
      ) : (
        <VoteStatusPanel
          body={body}
          onRetry={retry}
          onSeeSummary={() => {
            router.replace(summaryHref(groupId, roundId));
          }}
        />
      )}
    </Screen>
  );
}
