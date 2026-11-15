import { Pressable, View } from "react-native";

import type { GroupRole, Member, MemberType } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { ChevronRightIcon } from "../../../ui/Icons";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { roleLabel } from "../model/groups-list.selectors";
import type { MemberSheet, RoleChip } from "../model/member-actions";
import { memberRowModel } from "../model/members.selectors";

const { sheet, row } = strings.members;
const levelTexts = strings.ratings.optionsRow;

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

export interface LevelRowProps {
  readonly text: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

/** "Nota do sorteio · 4,0 · sugerida": opens the sheet 19a (admins only, ADR 0047). */
function LevelRow({ text, disabled, onPress }: LevelRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={levelTexts.label(text)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        minHeight: tokens.sizes.settingRowMin,
        paddingHorizontal: tokens.spacing.m,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {levelTexts.title}
      </Text>
      <Text variant="muted">{text}</Text>
      <ChevronRightIcon color={colors.textMuted} />
    </Pressable>
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
  /** "Nota do sorteio" and its text; `null` for who cannot see the levels. */
  readonly levelText: string | null;
  readonly onLevel: (target: Member) => void;
  readonly onRemove: (target: Member) => void;
}

/** The sheet 19c: role, type, the level for admins, "Remover" on another row, "Sair" on the own one. */
export function MemberOptionsSheet({
  sheet: options,
  pending,
  onClose,
  onRole,
  onType,
  onLeave,
  levelText,
  onLevel,
  onRemove,
}: MemberOptionsSheetProps) {
  const { tokens } = useTheme();
  if (options === null) return null;
  const { target } = options;
  const model = memberRowModel(target);
  return (
    <BottomSheet visible title={model.title} onClose={onClose}>
      <Text variant="muted">{model.detail}</Text>
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
      {options.showsLevel && levelText !== null ? (
        <LevelRow
          text={levelText}
          disabled={pending}
          onPress={() => {
            onLevel(target);
          }}
        />
      ) : null}
      {options.canRemove ? (
        <View style={{ gap: tokens.spacing.s }}>
          <Button
            label={sheet.remove}
            variant="dangerOutline"
            disabled={pending}
            onPress={() => {
              onRemove(target);
            }}
          />
          <Text variant="muted" style={{ textAlign: "center" }}>
            {sheet.removeHelp}
          </Text>
        </View>
      ) : null}
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
