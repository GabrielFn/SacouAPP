import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Stepper } from "../../../ui/Stepper";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import {
  FIXED_EXIT_RANGE,
  WINNER_WINS_RANGE,
  type ExitMode,
  type QueueRuleDraft,
} from "../model/queue-rule";
import type { QueueRuleAction } from "../model/queue-rule.reducer";

const { queueRuleScreen: texts } = strings.settings;

export interface RadioDotProps {
  readonly selected: boolean;
}

function RadioDot({ selected }: RadioDotProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.sizes.radioDot;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: selected ? tokens.sizes.radioDotSelectedBorder : tokens.borderWidths.thick,
        borderColor: selected ? colors.primary : colors.trackOff,
      }}
    />
  );
}

export interface OptionTextProps {
  readonly title: string;
  readonly body: string;
}

function OptionText({ title, body }: OptionTextProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.xs }}>
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption">{body}</Text>
    </View>
  );
}

export interface ModeOptionProps {
  readonly mode: ExitMode;
  readonly selected: boolean;
  readonly editable: boolean;
  readonly first?: boolean;
  readonly title: string;
  readonly body: string;
  readonly onSelect: (mode: ExitMode) => void;
  readonly children?: ReactNode;
}

/** One radio (.opt): the dot and the texts are the touch target; what goes under them (the stepper) is not. */
function ModeOption({
  mode,
  selected,
  editable,
  first = false,
  title,
  body,
  onSelect,
  children,
}: ModeOptionProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        padding: tokens.spacing.s14,
        borderTopWidth: first ? 0 : tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={title}
        accessibilityState={{ checked: selected, disabled: !editable }}
        disabled={!editable}
        onPress={() => {
          onSelect(mode);
        }}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: tokens.spacing.m,
          minHeight: tokens.sizes.minTouchTarget,
        }}
      >
        <RadioDot selected={selected} />
        <OptionText title={title} body={body} />
      </Pressable>
      {children === undefined ? null : (
        <View style={{ paddingLeft: tokens.sizes.radioDot + tokens.spacing.m }}>{children}</View>
      )}
    </View>
  );
}

export interface QueueRuleOptionsProps {
  readonly draft: QueueRuleDraft;
  readonly editable: boolean;
  readonly dispatch: (action: QueueRuleAction) => void;
}

/** "Do time que perdeu": three options in a radio group; the fixed one carries its stepper. */
export function LoserOptions({ draft, editable, dispatch }: QueueRuleOptionsProps) {
  const { colors, tokens } = useTheme();
  const select = (mode: ExitMode) => {
    dispatch({ type: "mode-selected", mode });
  };
  const fixed = draft.exitMode === "fixed-count";
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        overflow: "hidden",
      }}
    >
      <Text variant="bodyStrong" accessibilityRole="header" style={{ padding: tokens.spacing.s14 }}>
        {texts.loserTitle}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={texts.loserTitle}>
        <ModeOption
          first
          mode="automatic"
          selected={draft.exitMode === "automatic"}
          editable={editable}
          title={texts.automatic.title}
          body={texts.automatic.body}
          onSelect={select}
        />
        <ModeOption
          mode="whole-team"
          selected={draft.exitMode === "whole-team"}
          editable={editable}
          title={texts.wholeTeam.title}
          body={texts.wholeTeam.body}
          onSelect={select}
        />
        <ModeOption
          mode="fixed-count"
          selected={fixed}
          editable={editable}
          title={texts.fixedCount.title}
          body={texts.fixedCount.body}
          onSelect={select}
        >
          <Stepper
            value={draft.fixedExitCount}
            unit={texts.fixedCount.unit}
            lessLabel={texts.fixedCount.less}
            moreLabel={texts.fixedCount.more}
            canStepLess={editable && fixed && draft.fixedExitCount > FIXED_EXIT_RANGE.min}
            canStepMore={editable && fixed && draft.fixedExitCount < FIXED_EXIT_RANGE.max}
            onStep={(delta) => {
              dispatch({ type: "fixed-count-stepped", delta });
            }}
          />
        </ModeOption>
      </View>
    </View>
  );
}

/** "Vencedor também sai": the switch and, under it, how many wins in a row. */
export function WinnerOptions({ draft, editable, dispatch }: QueueRuleOptionsProps) {
  const { colors, tokens } = useTheme();
  const on = draft.winnerExitEnabled;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        padding: tokens.spacing.s14,
        gap: tokens.spacing.s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <OptionText title={texts.winner.title} body={texts.winner.body} />
        <Switch
          accessibilityLabel={texts.winner.title}
          checked={on}
          disabled={!editable}
          onChange={(enabled) => {
            dispatch({ type: "winner-toggled", enabled });
          }}
        />
      </View>
      <Stepper
        value={draft.winnerExitWins}
        unit={texts.winner.unit}
        lessLabel={texts.winner.less}
        moreLabel={texts.winner.more}
        canStepLess={editable && on && draft.winnerExitWins > WINNER_WINS_RANGE.min}
        canStepMore={editable && on && draft.winnerExitWins < WINNER_WINS_RANGE.max}
        onStep={(delta) => {
          dispatch({ type: "winner-wins-stepped", delta });
        }}
      />
    </View>
  );
}
