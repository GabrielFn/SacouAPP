import { useRouter } from "expo-router";
import { View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { GroupRole, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackIcon } from "../../../ui/Icons";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { IconButton } from "../../../ui/IconButton";
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
  readonly waitlist: string;
}

/** Everything under the title of screen 06: pills, panel, waitlist or the canceled strip. */
function RoundBody({ round, settings, waitlist }: RoundBodyProps) {
  const { tokens } = useTheme();
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
function RoundFooter({ actions }: { readonly actions: readonly PendingRoundScreen[] }) {
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

export interface AdminRoundScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * Screen 06 for who manages the rounds. A scorekeeper or a player gets the same page without buttons
 * until the player's screen (26) arrives in the next part.
 */
export function AdminRoundScreen({ groupId, roundId }: AdminRoundScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const settings = round.data === undefined ? null : roundSettingsOf(round.data);
  if (group.data === undefined || round.data === undefined) {
    const failed = group.error ?? round.error;
    return (
      <Screen>
        {failed === null ? (
          <LoadingState accessibilityLabel={detail.loading} />
        ) : (
          <EmptyState
            alert
            title={detail.loadError}
            body={errorTextOf(failed)}
            actions={[
              {
                label: detail.retry,
                variant: "secondary",
                onPress: () => {
                  void group.refetch();
                  void round.refetch();
                },
              },
            ]}
          />
        )}
      </Screen>
    );
  }
  const role: GroupRole = group.data.role;
  const waitlist = waitlistLine(
    rosterOf(round.data.waitlist, members.data ?? []),
  );
  const showWaitlist = settings?.values.attendance.waitlistEnabled === true;
  const actions = managesRounds(role)
    ? footerActions(PENDING_ROUND_SCREENS, isCanceled(round.data))
    : [];
  return (
    <Screen footer={actions.length === 0 ? undefined : <RoundFooter actions={actions} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <IconButton
          accessibilityLabel={strings.a11y.back}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace(groupsHref);
          }}
        >
          <BackIcon />
        </IconButton>
        <Text variant="bodyStrong">{roleHeader(role)}</Text>
      </View>
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {group.data.name}
        </Text>
        <Text variant="muted">{roundSubtitle(round.data)}</Text>
      </View>
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundBody round={round.data} settings={settings} waitlist={showWaitlist ? waitlist : ""} />
      )}
    </Screen>
  );
}
