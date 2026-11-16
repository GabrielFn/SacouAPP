import { View } from "react-native";

import type { GroupRole, Member, MemberType } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { roleLabel } from "../model/groups-list.selectors";
import type { MemberSheet, RoleChip } from "../model/member-actions";
import { memberRowModel } from "../model/members.selectors";

const { sheet, row } = strings.members;

const TYPE_OPTIONS: readonly { readonly value: MemberType; readonly label: string }[] = [
  { value: "regular", label: row.regular },
  { value: "dropIn", label: row.dropIn },
];

export interface RoleChipsProps {
  readonly chips: readonly RoleChip[];
  readonly lastAdmin: boolean;
  readonly disabled: boolean;
  readonly onRole: (role: GroupRole) => void;
}

function RoleChips({ chips, lastAdmin, disabled, onRole }: RoleChipsProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Text variant="bodyStrong">{sheet.role}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={sheet.role}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}
      >
        {chips.map((chip) => (
          <Chip
            key={chip.role}
            label={roleLabel(chip.role)}
            selected={chip.state === "current"}
            disabled={disabled || chip.state === "disabled"}
            onPress={() => {
              onRole(chip.role);
            }}
          />
        ))}
      </View>
      <Text variant="muted">{lastAdmin ? sheet.lastAdmin : sheet.roleHelp}</Text>
    </View>
  );
}

export interface MemberOptionsSheetProps {
  readonly sheet: MemberSheet | null;
  /** A write is on its way: the choices wait for it. */
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onRole: (target: Member, role: GroupRole) => void;
  readonly onType: (target: Member, memberType: MemberType) => void;
  readonly onLeave: () => void;
}

/** The sheet 19c: role, type and "Sair do grupo" on the own row (E4.5, D6). */
export function MemberOptionsSheet({
  sheet: options,
  pending,
  onClose,
  onRole,
  onType,
  onLeave,
}: MemberOptionsSheetProps) {
  const { tokens } = useTheme();
  if (options === null) return null;
  const { target } = options;
  return (
    <BottomSheet visible title={memberRowModel(target).title} onClose={onClose}>
      {options.roles === null ? null : (
        <RoleChips
          chips={options.roles}
          lastAdmin={options.lastAdmin}
          disabled={pending}
          onRole={(role) => {
            onRole(target, role);
          }}
        />
      )}
      {options.type === null ? null : (
        <View style={{ gap: tokens.spacing.s }}>
          <Text variant="bodyStrong">{sheet.type}</Text>
          <SegmentedControl
            options={TYPE_OPTIONS}
            selected={target.memberType}
            accessibilityLabel={sheet.type}
            disabled={pending || options.type.regularBlocked}
            onSelect={(memberType) => {
              onType(target, memberType);
            }}
          />
          {options.type.regularBlocked ? <Text variant="muted">{sheet.needsAccount}</Text> : null}
        </View>
      )}
      {options.canLeave ? (
        <View style={{ gap: tokens.spacing.s }}>
          <Button
            label={sheet.leave}
            variant="dangerOutline"
            disabled={pending || options.lastAdmin}
            onPress={onLeave}
          />
          {options.lastAdmin ? <Text variant="muted">{sheet.lastAdmin}</Text> : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}
