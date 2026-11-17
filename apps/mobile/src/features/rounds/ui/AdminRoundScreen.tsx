import { useRouter } from "expo-router";
import { View } from "react-native";

import type { Group, Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { PlusIcon } from "../../../ui/Icons";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { groupsHref } from "../../groups/navigation";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { hasRoundLayer, roundChips, sourceReader } from "../model/round-chips";
import {
  footerActions,
  roundFooterActions,
  isCanceled,
  roleHeader,
  statsCells,
  type RoundSettingsView,
} from "../model/round-detail";
import { canCopyList, removalName, rosterView, type RosterView } from "../model/round-screen-view";
import type { CopyNote } from "../model/round-screen.reducer";
import { canDraw } from "../../draw/model/can-draw";
import { useRoundCourt } from "../../court/hooks/use-round-court";
import { courtHref } from "../../court/navigation";
import {
  addPlayerHref,
  drawHref,
  PENDING_ROUND_SCREENS,
  type PendingRoundScreen,
} from "../navigation";
import { ConfirmedSheet } from "./ConfirmedSheet";
import { RoundChips } from "./RoundChips";
import { RoundHeading } from "./RoundHeading";
import { RoundStatsPanel } from "./RoundStatsPanel";

const { detail, confirmed } = strings.rounds;

export interface RoundBodyProps {
  readonly round: Round;
  readonly settings: RoundSettingsView;
  readonly waitlist: string;
  readonly onOpenConfirmed: () => void;
  readonly onAdd: () => void;
}

/** Everything under the title of screen 06: pills, panel, waitlist, "Adicionar…" or the canceled strip. */
function RoundBody({ round, settings, waitlist, onOpenConfirmed, onAdd }: RoundBodyProps) {
  const { tokens } = useTheme();
  const chips = roundChips(settings.values, sourceReader(settings.sources), {
    withRotation: false,
  });
  const attendance = settings.values.attendance.enabled;
  return (
    <>
      <RoundChips chips={chips} legend={hasRoundLayer(settings.sources)} />
      {isCanceled(round) ? (
        <ErrorStrip text={detail.canceled} />
      ) : (
        <>
          <RoundStatsPanel
            cells={statsCells(round, settings.values)}
            onOpenConfirmed={onOpenConfirmed}
          />
          {waitlist === "" ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
              <Text variant="bodyStrong">{detail.waitlistTitle}</Text>
              <Text variant="muted" style={{ flexShrink: 1 }}>
                {waitlist}
              </Text>
            </View>
          )}
          {attendance ? (
            <Button
              label={detail.addFromWhatsApp}
              variant="outline"
              renderIcon={(color) => <PlusIcon color={color} />}
              onPress={onAdd}
            />
          ) : null}
        </>
      )}
    </>
  );
}

/** "Abrir quadra" only with a court of this round on the device, "Sortear times" for who draws (D1). */
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
  readonly onCopy: () => void;
}

/** "Você é admin" with the back button, and "Copiar lista" on the right (Rodada.dc.html). */
function AdminHeader({ role, canCopy, copyNote, onCopy }: AdminHeaderProps) {
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
      {copyNote === "failed" ? <ErrorStrip text={detail.copyFailed} /> : null}
    </>
  );
}

export interface RemoveSheetsProps {
  readonly round: Round;
  readonly roster: RosterView;
  readonly model: RoundScreenModel;
}

/** The list with "Tirar" and its confirmation, one sheet at a time (question 47). */
function RemoveSheets({ round, roster, model }: RemoveSheetsProps) {
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
          isCanceled(round)
            ? null
            : (memberId) => {
                dispatch({ type: "remove-asked", memberId });
              }
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
  const read = useRoundCourt(round.roundId);
  const court = read.status === "read" ? read.court : null;
  const actions = roundFooterActions(
    footerActions(PENDING_ROUND_SCREENS, isCanceled(round)),
    canDraw(group.role),
    court !== null,
  );
  const footer = (
    <RoundFooter
      actions={actions}
      drawOff={settings?.values.draw.enabled === false}
      onDraw={() => {
        router.push(drawHref(groupId, round.roundId));
      }}
      onCourt={() => {
        if (court !== null) {
          router.push(courtHref("court", { courtSessionId: court.courtSessionId, theme: "sun" }));
        }
      }}
    />
  );
  return (
    <Screen footer={actions.length === 0 ? undefined : footer}>
      <AdminHeader
        role={group.role}
        canCopy={canCopyList(round, settings)}
        copyNote={model.state.copyNote}
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
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundBody
          round={round}
          settings={settings}
          waitlist={roster.waitlist}
          onOpenConfirmed={() => {
            model.dispatch({ type: "confirmed-opened" });
          }}
          onAdd={() => {
            router.push(addPlayerHref(groupId, round.roundId));
          }}
        />
      )}
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      <RemoveSheets round={round} roster={roster} model={model} />
    </Screen>
  );
}
