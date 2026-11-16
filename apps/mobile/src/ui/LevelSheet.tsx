import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { ErrorStrip } from "./ErrorStrip";
import { LockIcon, MinusIcon, PlusIcon } from "./Icons";
import {
  LEVEL_SHORTCUTS,
  canStep,
  formatLevel,
  levelOf,
  stepLevel,
  type LevelTenths,
} from "./skill-level";
import { StepButton } from "./Stepper";
import { Text } from "./Text";

const texts = strings.ratings.sheet;

export interface LevelSuggestionProps {
  readonly name: string;
  readonly tenths: LevelTenths;
  readonly disabled: boolean;
  readonly onUse: () => void;
}

/** "Bia sugeriu 4,0 no cadastro." with "Usar 4,0" (dashed yellow, only with a suggestion). */
function LevelSuggestion({ name, tenths, disabled, onUse }: LevelSuggestionProps) {
  const { colors, tokens } = useTheme();
  const level = formatLevel(tenths);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.noticeFill,
        borderWidth: tokens.borderWidths.thin,
        borderStyle: "dashed",
        borderColor: colors.suggestBorder,
      }}
    >
      <Text style={{ flex: 1, color: colors.suggestText }}>
        {`${texts.suggestionBefore(name)} `}
        <Text variant="bodyStrong">{level}</Text>
        {` ${texts.suggestionAfter}`}
      </Text>
      <Button
        label={texts.useSuggestion(level)}
        variant="outline"
        disabled={disabled}
        onPress={onUse}
      />
    </View>
  );
}

export interface LevelPickerProps {
  readonly value: LevelTenths;
  readonly disabled: boolean;
  readonly onChange: (tenths: LevelTenths) => void;
}

/** The big number between minus and plus, the shortcuts 1 to 5 and the two ends of the scale. */
function LevelPicker({ value, disabled, onChange }: LevelPickerProps) {
  const { tokens } = useTheme();
  const step = (direction: -1 | 1) => {
    onChange(stepLevel(value, direction));
  };
  return (
    <View style={{ gap: tokens.spacing.m }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.xxl,
        }}
      >
        <StepButton
          label={texts.less}
          size={tokens.sizes.levelStep}
          enabled={!disabled && canStep(value, -1)}
          onPress={() => {
            step(-1);
          }}
        >
          <MinusIcon />
        </StepButton>
        <Text
          variant="display"
          displaySize="displayLevel"
          tabular
          accessibilityLabel={texts.valueLabel(formatLevel(value))}
          accessibilityLiveRegion="polite"
          style={{ flex: 1, textAlign: "center", fontFamily: fontFamilies.display800 }}
        >
          {formatLevel(value)}
        </Text>
        <StepButton
          label={texts.more}
          size={tokens.sizes.levelStep}
          enabled={!disabled && canStep(value, 1)}
          onPress={() => {
            step(1);
          }}
        >
          <PlusIcon />
        </StepButton>
      </View>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel={texts.shortcuts}
        style={{ flexDirection: "row", gap: tokens.spacing.s }}
      >
        {LEVEL_SHORTCUTS.map((shortcut) => (
          <View key={shortcut} style={{ flex: 1 }}>
            <Chip
              kind="toggle"
              label={String(levelOf(shortcut))}
              selected={value === shortcut}
              disabled={disabled}
              onPress={() => {
                onChange(shortcut);
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="muted">{texts.lowest}</Text>
        <Text variant="muted">{texts.highest}</Text>
      </View>
    </View>
  );
}

export interface LevelSheetProps {
  readonly visible: boolean;
  /** The nickname; "Nota de {name}". */
  readonly name: string;
  /** "Ponteira · líbero · mensalista". */
  readonly detail: string;
  readonly initials: string | null;
  readonly dashedAvatar: boolean;
  /** The member's own suggestion, for "Usar 4,0"; `null` hides the strip. */
  readonly suggestion: LevelTenths | null;
  /** What the sheet shows: the draft of the owner, else the level it starts on. */
  readonly value: LevelTenths;
  /** A write is on its way. */
  readonly pending: boolean;
  readonly errorText: string | null;
  readonly onChange: (tenths: LevelTenths) => void;
  readonly onSave: (tenths: LevelTenths) => void;
  readonly onClose: () => void;
}

/**
 * The sheet 19a, "Nota de Bia" (NotaMembro.dc.html). Controlled: the owner keeps the draft (screen 19,
 * and later the guest of 21a), so the sheet holds no state. The level is private (ADR 0047): nothing here
 * logs it.
 */
export function LevelSheet(props: LevelSheetProps) {
  const { tokens } = useTheme();
  const { suggestion, value, pending } = props;
  return (
    <BottomSheet visible={props.visible} title={texts.title(props.name)} onClose={props.onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.m }}>
        <Avatar initials={props.initials} dashed={props.dashedAvatar} />
        <Text variant="muted" style={{ flex: 1 }}>
          {props.detail}
        </Text>
      </View>
      {suggestion === null ? null : (
        <LevelSuggestion
          name={props.name}
          tenths={suggestion}
          disabled={pending}
          onUse={() => {
            props.onChange(suggestion);
          }}
        />
      )}
      <LevelPicker value={value} disabled={pending} onChange={props.onChange} />
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <LockIcon />
        <Text variant="muted" style={{ flex: 1 }}>
          {texts.privacy(props.name)}
        </Text>
      </View>
      {props.errorText === null ? null : <ErrorStrip text={props.errorText} />}
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <Button fill label={texts.cancel} variant="outline" onPress={props.onClose} />
        <Button
          fill
          label={texts.save(formatLevel(value))}
          disabled={pending}
          onPress={() => {
            props.onSave(value);
          }}
        />
      </View>
    </BottomSheet>
  );
}
