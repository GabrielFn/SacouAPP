import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import type { Group, Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { groupSettingsHref, groupsHref } from "../../groups/navigation";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import {
  footerActions,
  roundFooterActions,
  isCanceled,
  isEnded,
  adminDropInWindow,
  adminRoundOffers,
  roleHeader,
  type RoundSettingsView,
} from "../model/round-detail";
import { roundLinkOffer } from "../model/round-link-offer";
import { canCopyList, removalName, rosterView, type RosterView } from "../model/round-screen-view";
import { adminTeams } from "../model/round-teams";
import type { CopyNote } from "../model/round-screen.reducer";
import { canDraw } from "../../draw/model/can-draw";
import { useRoundCourtEntry } from "../../court/hooks/use-round-court-entry";
import {
  addPlayerHref,
  drawHref,
  PENDING_ROUND_SCREENS,
  type PendingRoundScreen,
} from "../navigation";
import { ConfirmedSheet } from "./ConfirmedSheet";
import { EndedBadge, EndedFooter } from "./EndedRound";
import { RoundHeading } from "./RoundHeading";
import { RoundBody } from "./AdminRoundBody";
import { SummaryLink } from "./SummaryLink";

const { detail, confirmed } = strings.rounds;

/** "Abrir quadra" with a court of this round on the device or on the server (E4.11, D5), "Sortear times" for who draws (D1). */
export interface RoundFooterProps {
  readonly actions: readonly PendingRoundScreen[];
  /** With the draw off the 07 builds the teams by hand: "Montar times" (question 72). */
  readonly drawOff: boolean;
  readonly onDraw: () => void;
  readonly onCourt: () => void;
}

function RoundFooter({ actions, drawOff, onDraw, onCourt }: RoundFooterProps) {
  return (
    <>
      {actions.includes("court") ? <Button label={detail.openCourt} onPress={onCourt} /> : null}
      {actions.includes("draw") ? (
        <Button
          label={drawOff ? detail.buildTeams : detail.drawTimes}
          variant="secondary"
          onPress={onDraw}
        />
      ) : null}
    </>
  );
}

export interface AdminRoundScreenProps {
  readonly groupId: string;
  readonly group: Group;
  readonly round: Round;
  /** `null` when the resolved settings do not parse: nothing is drawn from them. */
  readonly settings: RoundSettingsView | null;
  readonly members: readonly Member[];
  readonly model: RoundScreenModel;
}

export interface AdminHeaderProps {
  readonly role: Group["role"];
  readonly canCopy: boolean;
  readonly copyNote: CopyNote;
  readonly shareFailed: boolean;
  readonly onCopy: () => void;
}

/** "Você é admin" with the back button, and "Copiar lista" on the right (Rodada.dc.html). */
function AdminHeader({ role, canCopy, copyNote, shareFailed, onCopy }: AdminHeaderProps) {
  const { tokens } = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <BackBar title={roleHeader(role)} fallbackHref={groupsHref} />
        </View>
        {canCopy ? <Button label={detail.copyList} variant="link" onPress={onCopy} /> : null}
      </View>
      {copyNote === "copied" ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {detail.listCopied}
        </Text>
      ) : null}
      {copyNote === "copied-with-link" ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {detail.listAndLinkCopied}
        </Text>
      ) : null}
      {shareFailed ? <ErrorStrip text={detail.shareFailed} /> : null}
      {copyNote === "failed" ? <ErrorStrip text={detail.copyFailed} /> : null}
    </>
  );
}

export interface RemoveSheetsProps {
  readonly round: Round;
  readonly roster: RosterView;
  readonly model: RoundScreenModel;
  readonly canRemove: boolean;
}

/** The list with "Tirar" and its confirmation, one sheet at a time (question 47). */
function RemoveSheets({ round, roster, model, canRemove }: RemoveSheetsProps) {
  const { state, dispatch } = model;
  const removing = state.sheet.kind === "remove" ? state.sheet.memberId : null;
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <>
      <ConfirmedSheet
        visible={state.sheet.kind === "confirmed"}
        going={roster.going}
        waitlistLine={roster.waitlist}
        meId={round.me.memberId}
        removing={model.removing}
        onRemove={
          canRemove
            ? (memberId) => {
                dispatch({ type: "remove-asked", memberId });
              }
            : null
        }
        onClose={close}
      />
      <ConfirmSheet
        visible={removing !== null}
        title={confirmed.removeTitle}
        body={confirmed.removeBody(removalName(roster.going, removing ?? "", round.me.memberId))}
        confirmLabel={confirmed.removeConfirm}
        cancelLabel={confirmed.cancel}
        onConfirm={() => {
          if (removing !== null) model.removeMember(removing);
        }}
        onCancel={close}
      />
    </>
  );
}

/** The footer of screen 06: the way to the summary when over, the buttons while there are any, else none. */
function screenFooter(
  ended: boolean,
  hasActions: boolean,
  groupId: string,
  roundId: string,
  buttons: ReactNode,
): ReactNode {
  if (ended) return <EndedFooter groupId={groupId} roundId={roundId} />;
  return hasActions ? buttons : undefined;
}

/** Screen 06, for who manages the rounds: the counts, the list with "Tirar" and "Copiar lista". */
export function AdminRoundScreen({
  groupId,
  group,
  round,
  settings,
  members,
  model,
}: AdminRoundScreenProps) {
  const router = useRouter();
  const roster = rosterView(round, settings, members);
  const canceled = isCanceled(round);
  const ended = isEnded(round, model.now);
  const offers = adminRoundOffers(round, model.now, settings?.values.attendance.enabled ?? false);
  const court = useRoundCourtEntry({ groupId, roundId: round.roundId }, offers.courtEntryEnabled);
  const actions = roundFooterActions(
    footerActions(PENDING_ROUND_SCREENS, canceled || ended),
    canDraw(group.role),
    court.available,
  );
  const linkOffer = roundLinkOffer(round, model.now);
  const dropInWindow = adminDropInWindow(round, model.now);
  const drawOff = settings?.values.draw.enabled === false;
  const teams = adminTeams(round, members, { role: group.role, ended, drawOff });
  const footer = (
    <RoundFooter
      actions={actions}
      drawOff={drawOff}
      onDraw={() => {
        router.push(drawHref(groupId, round.roundId));
      }}
      onCourt={court.open}
    />
  );
  return (
    <Screen footer={screenFooter(ended, actions.length > 0, groupId, round.roundId, footer)}>
      <AdminHeader
        role={group.role}
        canCopy={canCopyList(round, settings)}
        copyNote={model.state.copyNote}
        shareFailed={model.state.shareNote === "failed"}
        onCopy={() => {
          model.copyList({
            groupName: group.name,
            round,
            members,
            waitlistEnabled: roster.waitlistEnabled,
          });
        }}
      />
      <RoundHeading groupName={group.name} round={round} />
      {ended ? <EndedBadge /> : null}
      <SummaryLink groupId={groupId} round={round} now={model.now} />
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundBody
          round={round}
          settings={settings}
          waitlist={roster.waitlist}
          canAdd={offers.canAdd}
          teams={teams}
          canShare={linkOffer.kind === "share"}
          onShare={() => {
            model.shareLink(group.name, round);
          }}
          dropInPhrase={dropInWindow?.phrase ?? null}
          onChangeDropInWindow={() => {
            router.push(groupSettingsHref(groupId));
          }}
          onOpenConfirmed={() => {
            model.dispatch({ type: "confirmed-opened" });
          }}
          onAdd={() => {
            router.push(addPlayerHref(groupId, round.roundId));
          }}
        />
      )}
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      <RemoveSheets round={round} roster={roster} model={model} canRemove={offers.canRemove} />
    </Screen>
  );
}
