import { View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { GroupRole, Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { groupsHref } from "../../groups/navigation";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { hasRoundLayer, roundChips, sourceReader } from "../model/round-chips";
import {
  footerActions,
  isCanceled,
  managesRounds,
  roleHeader,
  roundSettingsOf,
  roundSubtitle,
  statsCells,
  type RoundSettingsView,
} from "../model/round-detail";
import { rosterOf, waitlistLine } from "../model/roster";
import { PENDING_ROUND_SCREENS, type PendingRoundScreen } from "../navigation";
import { useRound } from "../queries/use-round-queries";
import { RoundChips } from "./RoundChips";
import { RoundStatsPanel } from "./RoundStatsPanel";

const { detail } = strings.rounds;

export interface RoundBodyProps {
  readonly round: Round;
  readonly settings: RoundSettingsView;
  readonly members: readonly Member[];
}

/** Everything under the title of screen 06: pills, panel, waitlist or the canceled strip. */
function RoundBody({ round, settings, members }: RoundBodyProps) {
  const { tokens } = useTheme();
  const waitlist = settings.values.attendance.waitlistEnabled
    ? waitlistLine(rosterOf(round.waitlist, members))
    : "";
  const chips = roundChips(settings.values, sourceReader(settings.sources), {
    withRotation: false,
  });
  return (
    <>
      <RoundChips chips={chips} legend={hasRoundLayer(settings.sources)} />
      {isCanceled(round) ? (
        <ErrorStrip text={detail.canceled} />
      ) : (
        <>
          <RoundStatsPanel cells={statsCells(round, settings.values)} />
          {waitlist === "" ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
              <Text variant="bodyStrong">{detail.waitlistTitle}</Text>
              <Text variant="muted" style={{ flexShrink: 1 }}>
                {waitlist}
              </Text>
            </View>
          )}
        </>
      )}
    </>
  );
}

/** "Sortear times" and "Abrir quadra" appear when their screens exist (D1). */
export interface RoundFooterProps {
  readonly actions: readonly PendingRoundScreen[];
}

function RoundFooter({ actions }: RoundFooterProps) {
  return (
    <>
      {actions.includes("court") ? <Button label={detail.openCourt} onPress={noAction} /> : null}
      {actions.includes("draw") ? (
        <Button label={detail.drawTimes} variant="secondary" onPress={noAction} />
      ) : null}
    </>
  );
}

function noAction(): void {
  // The destinations (E4.7 and the court) take over these buttons when they exist.
}

export interface RoundLoadingProps {
  readonly failure: Error | null;
  readonly onRetry: () => void;
}

/** The wait for the round, or the reason it could not be read. */
function RoundLoading({ failure, onRetry }: RoundLoadingProps) {
  if (failure === null) return <LoadingState accessibilityLabel={detail.loading} />;
  return (
    <EmptyState
      alert
      title={detail.loadError}
      body={errorTextOf(failure)}
      actions={[{ label: detail.retry, variant: "secondary", onPress: onRetry }]}
    />
  );
}

export interface AdminRoundScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * Screen 06 for who manages the rounds. A scorekeeper or a player gets the same page without buttons
 * until the player's screen (26) arrives in the next part.
 */
export function AdminRoundScreen({ groupId, roundId }: AdminRoundScreenProps) {
  const { tokens } = useTheme();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const settings = round.data === undefined ? null : roundSettingsOf(round.data);
  if (group.data === undefined || round.data === undefined) {
    return (
      <Screen>
        <RoundLoading
          failure={group.error ?? round.error}
          onRetry={() => {
            void group.refetch();
            void round.refetch();
          }}
        />
      </Screen>
    );
  }
  const role: GroupRole = group.data.role;
  const actions = managesRounds(role)
    ? footerActions(PENDING_ROUND_SCREENS, isCanceled(round.data))
    : [];
  return (
    <Screen footer={actions.length === 0 ? undefined : <RoundFooter actions={actions} />}>
      <BackBar title={roleHeader(role)} fallbackHref={groupsHref} />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {group.data.name}
        </Text>
        <Text variant="muted">{roundSubtitle(round.data)}</Text>
      </View>
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundBody round={round.data} settings={settings} members={members.data ?? []} />
      )}
    </Screen>
  );
}
