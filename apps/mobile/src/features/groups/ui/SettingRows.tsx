import type { SettingsPath, SettingsValue } from "@sacou/match-engine";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Chip } from "../../../ui/Chip";
import { ChevronRightIcon } from "../../../ui/Icons";
import { ProBadge } from "../../../ui/ProBadge";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import { choiceOptions } from "../model/group-settings.selectors";

const { screen, queueRule } = strings.settings;

export interface RowFrameProps {
  readonly children: ReactNode;
}

/** A line of a block (.row): a hairline above it and room for the control at the right. */
export function RowFrame({ children }: RowFrameProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.settingRowMin,
        paddingLeft: tokens.spacing.s14,
        paddingRight: tokens.spacing.s6,
        borderTopWidth: tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      {children}
    </View>
  );
}

export interface SwitchRowProps {
  readonly path: SettingsPath;
  readonly label: string;
  readonly checked: boolean;
  readonly pro: boolean;
  readonly editable: boolean;
  readonly onChange: (path: SettingsPath, value: SettingsValue) => void;
}

export function SwitchRow({ path, label, checked, pro, editable, onChange }: SwitchRowProps) {
  const { tokens } = useTheme();
  return (
    <RowFrame>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
          {label}
        </Text>
        {pro ? <ProBadge /> : null}
      </View>
      <Switch
        accessibilityLabel={pro ? screen.proLabel(label) : label}
        checked={checked}
        disabled={!editable}
        onChange={(value) => {
          onChange(path, value);
        }}
      />
    </RowFrame>
  );
}

export interface ValueRowProps {
  readonly label: string;
  readonly value: string;
  readonly editable: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
}

/** A line with a value at the right that opens a sheet; read only, it is plain text. */
export function ValueRow({ label, value, editable, onPress, accessibilityLabel }: ValueRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <RowFrame>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? screen.editValue(label, value)}
        accessibilityState={{ disabled: !editable }}
        disabled={!editable}
        onPress={onPress}
        style={{
          minHeight: tokens.sizes.switchTarget,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          paddingHorizontal: tokens.spacing.s,
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: fontFamilies.body600,
          }}
        >
          {value}
        </Text>
        {editable ? <ChevronRightIcon /> : null}
      </Pressable>
    </RowFrame>
  );
}

export interface QueueRuleRowProps {
  readonly summary: string;
  readonly editable: boolean;
  readonly onPress: () => void;
}

/** The rule of the queue in one line; for admins it opens screen 18a. */
export function QueueRuleRow({ summary, editable, onPress }: QueueRuleRowProps) {
  return (
    <>
      <ValueRow
        label={queueRule.label}
        value={summary}
        editable={editable}
        onPress={onPress}
        accessibilityLabel={queueRule.accessibility(summary)}
      />
      <HelpLine text={queueRule.help} />
    </>
  );
}

export interface HelpLineProps {
  readonly text: string;
}

export function HelpLine({ text }: HelpLineProps) {
  const { tokens } = useTheme();
  return (
    <Text
      variant="caption"
      style={{ paddingHorizontal: tokens.spacing.s14, paddingBottom: tokens.spacing.s }}
    >
      {text}
    </Text>
  );
}

export interface ChoiceRowProps {
  readonly path: SettingsPath;
  readonly label: string;
  readonly layout: "chips" | "segmented" | "systems";
  readonly selected: SettingsValue | undefined;
  readonly editable: boolean;
  readonly onChange: (path: SettingsPath, value: SettingsValue) => void;
}

/** A choice leaf: chips that wrap, a segmented control, or the grid of rotation systems. */
export function ChoiceRow({ path, label, layout, selected, editable, onChange }: ChoiceRowProps) {
  const { tokens } = useTheme();
  const options = choiceOptions(path);
  return (
    <View style={{ gap: tokens.spacing.s, paddingBottom: tokens.spacing.m }}>
      <Text
        variant="bodyStrong"
        accessibilityRole="header"
        style={{ paddingHorizontal: tokens.spacing.s14, paddingTop: tokens.spacing.s10 }}
      >
        {label}
      </Text>
      <View style={{ paddingHorizontal: tokens.spacing.s14 }}>
        {layout === "segmented" ? (
          <SegmentedControl
            accessibilityLabel={label}
            disabled={!editable}
            options={options.map(({ value, label: text }) => ({ value, label: text }))}
            selected={selected ?? ""}
            onSelect={(value) => {
              onChange(path, value);
            }}
          />
        ) : (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={label}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}
          >
            {options.map((option) =>
              layout === "systems" ? (
                <SystemButton
                  key={String(option.value)}
                  label={option.label}
                  pro={option.pro}
                  selected={option.value === selected}
                  editable={editable}
                  onPress={() => {
                    onChange(path, option.value);
                  }}
                />
              ) : (
                <Chip
                  key={String(option.value)}
                  label={option.label}
                  selected={option.value === selected}
                  disabled={!editable}
                  onPress={() => {
                    onChange(path, option.value);
                  }}
                />
              ),
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export interface SystemButtonProps {
  readonly label: string;
  readonly pro: boolean;
  readonly selected: boolean;
  readonly editable: boolean;
  readonly onPress: () => void;
}

const SYSTEM_FLEX_BASIS = "22%";

/** One rotation system (.sys button): the name in the display font and the Pro tag under it. */
function SystemButton({ label, pro, selected, editable, onPress }: SystemButtonProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={pro ? screen.proLabel(label) : label}
      accessibilityState={{ checked: selected, disabled: !editable }}
      disabled={!editable}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: SYSTEM_FLEX_BASIS,
        minHeight: tokens.sizes.systemButton,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: selected ? colors.text : colors.borderChip,
        backgroundColor: selected ? colors.text : colors.surface,
      }}
    >
      <Text
        variant="display"
        displaySize="displayBlock"
        style={{ color: selected ? colors.background : colors.text }}
      >
        {label}
      </Text>
      {pro ? <ProBadge /> : null}
    </Pressable>
  );
}
