import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LinkIcon, QrIcon } from "../../../ui/Icons";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { TabSwitch } from "../../../ui/TabSwitch";
import { Text } from "../../../ui/Text";
import { useMembersScreen, type MembersScreenModel } from "../hooks/use-members-screen";
import { optionsLevelText } from "../model/member-levels";
import {
  memberName,
  membersHeader,
  membersOfTab,
  membersTabs,
  shownTabOf,
  tabLabel,
  type MembersTab,
} from "../model/members.selectors";
import { groupInviteHref, groupRatingsHref, groupsHref } from "../navigation";
import { LevelNotices, MemberLevelDialog } from "./MemberLevelParts";
import { MemberOptionsSheet } from "./MemberOptionsSheet";
import { InvitesList, MembersList } from "./MembersLists";

const texts = strings.members;

export interface InviteFooterProps {
  readonly onInvite: () => void;
}

/** "Convidar por link" and "QR do grupo" open the same screen 19d (D1). */
function InviteFooter({ onInvite }: InviteFooterProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
      <Button
        fill
        label={texts.footer.inviteLink}
        onPress={onInvite}
        renderIcon={(color) => <LinkIcon color={color} />}
      />
      <Button
        fill
        label={texts.footer.qr}
        variant="outline"
        onPress={onInvite}
        renderIcon={(color) => <QrIcon color={color} />}
      />
    </View>
  );
}

export interface MembersDialogsProps {
  readonly model: MembersScreenModel;
  readonly onLeft: () => void;
}

/** The sheet 19c and the confirmations, one at a time (the reducer keeps only one open). */
function MembersDialogs({ model, onLeft }: MembersDialogsProps) {
  const { state, dispatch } = model;
  const confirm = state.confirm;
  const removed =
    confirm?.kind === "remove"
      ? (model.members.data?.find((member) => member.memberId === confirm.memberId) ?? null)
      : null;
  const closeConfirm = () => {
    dispatch({ type: "confirm-closed" });
  };
  return (
    <>
      <MemberOptionsSheet
        sheet={model.sheet}
        pending={model.pending}
        onClose={() => {
          dispatch({ type: "sheet-closed" });
        }}
        onRole={model.changeRole}
        onType={model.changeType}
        onLeave={() => {
          dispatch({ type: "leave-asked" });
        }}
        levelText={
          model.sheet === null || model.levelOf === null
            ? null
            : optionsLevelText(model.levelOf(model.sheet.target.memberId))
        }
        onLevel={(target) => {
          dispatch({ type: "level-opened", memberId: target.memberId });
        }}
        onRemove={(target) => {
          dispatch({ type: "remove-asked", memberId: target.memberId });
        }}
      />
      <MemberLevelDialog model={model} />
      <ConfirmSheet
        visible={removed !== null}
        title={
          removed === null
            ? texts.sheet.remove
            : texts.sheet.removeConfirmTitle(memberName(removed))
        }
        body={texts.sheet.removeHelp}
        confirmLabel={texts.sheet.removeConfirm}
        cancelLabel={texts.sheet.cancel}
        onConfirm={() => {
          if (removed !== null) model.removeMember(removed);
        }}
        onCancel={closeConfirm}
      />
      <ConfirmSheet
        visible={confirm?.kind === "leave"}
        title={texts.sheet.leaveConfirmTitle}
        body={texts.sheet.leaveConfirmBody}
        confirmLabel={texts.sheet.leaveConfirm}
        cancelLabel={texts.sheet.cancel}
        onConfirm={() => {
          model.leave(onLeft);
        }}
        onCancel={closeConfirm}
      />
      <ConfirmSheet
        visible={confirm?.kind === "revoke-invite"}
        title={texts.invites.revokeConfirmTitle}
        body={texts.invites.revokeConfirmBody}
        confirmLabel={texts.invites.revoke}
        cancelLabel={texts.sheet.cancel}
        onConfirm={() => {
          if (confirm?.kind === "revoke-invite") model.revokeInvite(confirm.inviteId);
        }}
        onCancel={closeConfirm}
      />
    </>
  );
}

export interface MembersLoadingProps {
  readonly failure: Error | null;
  readonly onRetry: () => void;
}

function MembersLoading({ failure, onRetry }: MembersLoadingProps) {
  return (
    <Screen>
      {failure === null ? (
        <LoadingState accessibilityLabel={texts.loading} />
      ) : (
        <EmptyState
          alert
          title={texts.loadError}
          body={errorTextOf(failure)}
          actions={[{ label: texts.retry, variant: "secondary", onPress: onRetry }]}
        />
      )}
    </Screen>
  );
}

export interface MembersScreenProps {
  readonly groupId: string;
}

/**
 * Screen 19: who is in the group, its role, type and positions, the invites and, for admins and co-admins
 * only, the level of each one (ADR 0047). Placar and Jogador never ask for the levels.
 */
export function MembersScreen({ groupId }: MembersScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const { inviteBaseUrl } = useServices();
  const model = useMembersScreen(groupId);
  const [tab, setTab] = useState<MembersTab>("regular");
  const { group, members } = model;
  if (group.data === undefined || members.data === undefined) {
    return (
      <MembersLoading
        failure={group.error ?? members.error}
        onRetry={() => {
          void group.refetch();
          void members.refetch();
        }}
      />
    );
  }
  const tabs = membersTabs(group.data.role);
  const shownTab = shownTabOf(tabs, tab);
  const showInvite = model.canInvite && inviteBaseUrl !== null;
  // The sheet 19a shows its own refusal; the screen does not repeat it under the sheet.
  const screenError = model.levelSheet === null ? model.errorText : null;
  return (
    <Screen
      scroll
      footer={
        showInvite ? (
          <InviteFooter
            onInvite={() => {
              router.push(groupInviteHref(groupId));
            }}
          />
        ) : undefined
      }
    >
      <BackBar title={membersHeader(group.data.name, group.data.role)} fallbackHref={groupsHref} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: tokens.spacing.s10 }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {texts.title}
        </Text>
        <Text variant="muted">{texts.count(group.data.activeMembers)}</Text>
      </View>
      <TabSwitch
        options={tabs.map((value) => ({ value, label: tabLabel(value, members.data) }))}
        selected={shownTab}
        onSelect={setTab}
        accessibilityLabel={texts.tabs.label}
      />
      {model.levelOf === null ? null : (
        <LevelNotices
          pendingCount={model.pendingCount}
          onReview={() => {
            router.push(groupRatingsHref(groupId));
          }}
        />
      )}
      {screenError === null ? null : <ErrorStrip text={screenError} />}
      {shownTab === "invites" ? (
        <InvitesList
          invites={model.invites}
          disabled={model.pending}
          onRevoke={(inviteId) => {
            model.dispatch({ type: "revoke-asked", inviteId });
          }}
        />
      ) : (
        <MembersList
          members={membersOfTab(members.data, shownTab)}
          all={members.data}
          levelOf={model.levelOf}
          onLevel={(memberId) => {
            model.dispatch({ type: "level-opened", memberId });
          }}
          onOptions={(memberId) => {
            model.dispatch({ type: "sheet-opened", memberId });
          }}
        />
      )}
      <MembersDialogs
        model={model}
        onLeft={() => {
          router.replace(groupsHref);
        }}
      />
    </Screen>
  );
}
