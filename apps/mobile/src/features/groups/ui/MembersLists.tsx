import type { ReactNode } from "react";
import { View } from "react-native";

import type { Member } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LoadingState } from "../../../ui/LoadingState";
import { Text } from "../../../ui/Text";
import type { LevelLookup, useMembersScreen } from "../hooks/use-members-screen";
import { levelBadge } from "../model/member-levels";
import { inviteRows, memberName, memberRowModel } from "../model/members.selectors";
import { InviteRow } from "./InviteRow";
import { MemberRow } from "./MemberRow";

const texts = strings.members;

export interface ListCardProps {
  readonly children: ReactNode;
}

function ListCard({ children }: ListCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export interface MembersListProps {
  readonly members: readonly Member[];
  readonly all: readonly Member[];
  /** `null` for Placar and Jogador: no level, and the route is never called (ADR 0047). */
  readonly levelOf: LevelLookup;
  readonly onLevel: (memberId: string) => void;
  readonly onOptions: (memberId: string) => void;
}

export function MembersList({ members, all, levelOf, onLevel, onOptions }: MembersListProps) {
  const me = all.find((member) => member.isMe);
  if (members.length === 0) return <Text variant="muted">{texts.empty}</Text>;
  return (
    <ListCard>
      {members.map((member) => {
        // Every row has a sheet for who is in the list (E6.6: anyone may report someone else).
        const hasSheet = me !== undefined;
        return (
          <MemberRow
            key={member.memberId}
            model={memberRowModel(member)}
            own={member.isMe}
            level={
              levelOf === null ? null : levelBadge(memberName(member), levelOf(member.memberId))
            }
            onLevel={() => {
              onLevel(member.memberId);
            }}
            onOptions={
              hasSheet
                ? () => {
                    onOptions(member.memberId);
                  }
                : null
            }
          />
        );
      })}
    </ListCard>
  );
}

export interface InvitesListProps {
  readonly invites: ReturnType<typeof useMembersScreen>["invites"];
  readonly disabled: boolean;
  readonly onRevoke: (inviteId: string) => void;
}

export function InvitesList({ invites, disabled, onRevoke }: InvitesListProps) {
  if (invites.data === undefined) {
    return invites.error === null ? (
      <LoadingState accessibilityLabel={texts.loading} />
    ) : (
      <ErrorStrip text={texts.invites.loadError} />
    );
  }
  const rows = inviteRows(invites.data);
  if (rows.length === 0) return <Text variant="muted">{texts.invites.empty}</Text>;
  return (
    <ListCard>
      {rows.map((row) => (
        <InviteRow
          key={row.inviteId}
          model={row}
          disabled={disabled}
          onRevoke={() => {
            onRevoke(row.inviteId);
          }}
        />
      ))}
    </ListCard>
  );
}
