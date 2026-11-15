import { View } from "react-native";

import type { AttendanceResponse, Group, Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { groupsHref } from "../../groups/navigation";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { confirmedSummary, summaryText } from "../model/confirmed-summary";
import {
  holdsSpot,
  presenceCard,
  presenceCounts,
  type PresenceActions,
} from "../model/presence-card";
import { roundChips, sourceReader } from "../model/round-chips";
import { roleHeader, type RoundSettingsView } from "../model/round-detail";
import { rosterOf, waitlistLine, type RosterEntry } from "../model/roster";
import { ConfirmedSheet } from "./ConfirmedSheet";
import { PresenceCard } from "./PresenceCard";
import { RoundChips } from "./RoundChips";
import { RoundHeading } from "./RoundHeading";

const { presence, confirmed, detail } = strings.rounds;

export interface PresenceFooterProps {
  readonly actions: PresenceActions;
  readonly pending: boolean;
  readonly onRespond: (response: AttendanceResponse) => void;
  readonly onAskLeave: () => void;
}

/** "VOU" and "Não vou", or "Não vou mais" with its warning (RodadaJogador.dc.html). */
function PresenceFooter({ actions, pending, onRespond, onAskLeave }: PresenceFooterProps) {
  switch (actions.kind) {
    case "none":
      return null;
    case "answer":
      return (
        <>
          <Button
            label={presence.goingAction}
            disabled={!actions.canGo || pending}
            onPress={() => {
              onRespond("going");
            }}
          />
          <Button
            label={presence.notGoingAction}
            variant="outline"
            disabled={pending}
            onPress={() => {
              onRespond("notGoing");
            }}
          />
        </>
      );
    case "leave":
      return (
        <>
          <Button
            label={actions.label}
            variant="outline"
            disabled={pending}
            onPress={() => {
              if (actions.needsConfirm) onAskLeave();
              else onRespond("notGoing");
            }}
          />
          {actions.warning === null ? null : (
            <Text variant="muted" style={{ textAlign: "center" }}>
              {actions.warning}
            </Text>
          )}
        </>
      );
  }
}

export interface ConfirmedBlockProps {
  readonly going: readonly RosterEntry[];
  readonly meId: string;
  readonly waitlist: string;
  readonly onSeeAll: () => void;
}

/** The white card "Confirmados" with the avatars, the line of names and the waitlist. */
function ConfirmedBlock({ going, meId, waitlist, onSeeAll }: ConfirmedBlockProps) {
  const { colors, tokens } = useTheme();
  const summary = confirmedSummary(going, meId);
  return (
    <View
      style={{
        gap: tokens.spacing.s,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
          {confirmed.title}
        </Text>
        {going.length === 0 ? null : (
          <Button label={confirmed.seeAll(going.length)} variant="link" onPress={onSeeAll} />
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.m }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: tokens.spacing.xs }}
        >
          {summary.initials.map((initial, index) => (
            <View
              key={`${initial}-${String(index)}`}
              style={{
                width: tokens.sizes.avatar,
                aspectRatio: 1,
                borderRadius: tokens.radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.avatarSurface,
              }}
            >
              <Text variant="bodyStrong">{initial}</Text>
            </View>
          ))}
        </View>
        <Text variant="muted" accessibilityLabel={summaryText(summary)} style={{ flex: 1 }}>
          {summary.parts.map((part, index) =>
            part.strong ? (
              <Text key={String(index)} variant="bodyStrong">
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      </View>
      {waitlist === "" ? null : <Text variant="muted">{confirmed.waitlist(waitlist)}</Text>}
    </View>
  );
}

export interface PlayerRoundScreenProps {
  readonly group: Group;
  readonly round: Round;
  readonly settings: RoundSettingsView | null;
  readonly members: readonly Member[];
  readonly model: RoundScreenModel;
}

/** Screen 26, for the player and the scorekeeper: the own answer and who is going (D7). */
export function PlayerRoundScreen({ group, round, settings, members, model }: PlayerRoundScreenProps) {
  const { state, dispatch } = model;
  const values = settings?.values ?? null;
  const waitlistEnabled = values?.attendance.waitlistEnabled ?? false;
  const waitlistRoster = waitlistEnabled ? rosterOf(round.waitlist, members) : [];
  const waitlist = waitlistLine(waitlistRoster);
  const going = rosterOf(round.going, members);
  const myType = members.find((member) => member.isMe)?.memberType ?? null;
  const card =
    values === null || !values.attendance.enabled
      ? null
      : presenceCard({ round, values, waitlist: waitlistRoster, myType, now: model.now });
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <Screen
      footer={
        card === null || card.actions.kind === "none" ? undefined : (
          <PresenceFooter
            actions={card.actions}
            pending={model.responding}
            onRespond={model.respond}
            onAskLeave={() => {
              dispatch({ type: "leave-asked" });
            }}
          />
        )
      }
    >
      <BackBar title={roleHeader(group.role)} fallbackHref={groupsHref} />
      <RoundHeading groupName={group.name} round={round} />
      {settings === null ? (
        <ErrorStrip text={detail.loadError} />
      ) : (
        <RoundChips
          chips={roundChips(settings.values, sourceReader(settings.sources), {
            withRotation: false,
          })}
          legend={false}
        />
      )}
      {card === null || values === null ? null : (
        <>
          <PresenceCard view={card} counts={presenceCounts(round, values)} going={holdsSpot(round)} />
          <ConfirmedBlock
            going={going}
            meId={round.me.memberId}
            waitlist={waitlist}
            onSeeAll={() => {
              dispatch({ type: "confirmed-opened" });
            }}
          />
        </>
      )}
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      <ConfirmedSheet
        visible={state.sheet.kind === "confirmed"}
        going={going}
        waitlistLine={waitlist}
        meId={round.me.memberId}
        onRemove={null}
        removing={false}
        onClose={close}
      />
      <ConfirmSheet
        visible={state.sheet.kind === "leave"}
        title={presence.leaveTitle}
        body={presence.leaveBody}
        confirmLabel={presence.leaveConfirm}
        cancelLabel={presence.keep}
        onConfirm={() => {
          model.respond("notGoing");
        }}
        onCancel={close}
      />
    </Screen>
  );
}
