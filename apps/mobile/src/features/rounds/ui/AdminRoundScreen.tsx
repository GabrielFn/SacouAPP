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
  isCanceled,
  roleHeader,
  statsCells,
  type RoundSettingsView,
} from "../model/round-detail";
import { rosterOf, waitlistLine } from "../model/roster";
import { addPlayerHref, PENDING_ROUND_SCREENS, type PendingRoundScreen } from "../navigation";
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

export interface AdminRoundScreenProps {
  readonly groupId: string;
  readonly group: Group;
  readonly round: Round;
  /** `null` when the resolved settings do not parse: nothing is drawn from them. */
  readonly settings: RoundSettingsView | null;
  readonly members: readonly Member[];
  readonly model: RoundScreenModel;
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
  const { tokens } = useTheme();
  const { state, dispatch } = model;
  const waitlistEnabled = settings?.values.attendance.waitlistEnabled ?? false;
  const waitlist = waitlistEnabled ? waitlistLine(rosterOf(round.waitlist, members)) : "";
  const going = rosterOf(round.going, members);
  const canCopy = settings?.values.attendance.enabled === true && !isCanceled(round);
  const actions = footerActions(PENDING_ROUND_SCREENS, isCanceled(round));
  const removing = state.sheet.kind === "remove" ? state.sheet.memberId : null;
  const removingName =
    going.find((entry) => entry.memberId === removing)?.name ?? detail.noName;
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <Screen footer={actions.length === 0 ? undefined : <RoundFooter actions={actions} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <BackBar title={roleHeader(group.role)} fallbackHref={groupsHref} />
        </View>
        {canCopy ? (
          <Button
            label={detail.copyList}
            variant="link"
            onPress={() => {
              model.copyList({ groupName: group.name, round, members, waitlistEnabled });
            }}
          />
        ) : null}
      </View>
      {state.copied ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {detail.listCopied}
        </Text>
      ) : null}
      <RoundHeading groupName={group.name} round={round} />
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundBody
          round={round}
          settings={settings}
          waitlist={waitlist}
          onOpenConfirmed={() => {
            dispatch({ type: "confirmed-opened" });
          }}
          onAdd={() => {
            router.push(addPlayerHref(groupId, round.roundId));
          }}
        />
      )}
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      <ConfirmedSheet
        visible={state.sheet.kind === "confirmed"}
        going={going}
        waitlistLine={waitlist}
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
        body={confirmed.removeBody(
          removing === round.me.memberId ? confirmed.youRow : removingName,
        )}
        confirmLabel={confirmed.removeConfirm}
        cancelLabel={confirmed.cancel}
        onConfirm={() => {
          if (removing !== null) model.removeMember(removing);
        }}
        onCancel={close}
      />
    </Screen>
  );
}
