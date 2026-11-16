import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { LockIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { SELF_LEVEL_OPTIONS, type SelfLevelOption } from "../model/self-levels";
import { ProfileSection } from "./ProfileSection";

export interface LevelPickerProps {
  /** In points; a half point saved elsewhere selects nothing and is kept. */
  readonly level: number | null;
  readonly onPick: (level: number) => void;
}

export interface LevelOptionProps {
  readonly option: SelfLevelOption;
  readonly selected: boolean;
  readonly onPick: (level: number) => void;
}

function LevelOption({ option, selected, onPick }: LevelOptionProps) {
  const { colors, tokens } = useTheme();
  const { level, text } = option;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={strings.profile.levelLabel(level, text)}
      accessibilityState={{ selected }}
      onPress={() => {
        onPick(level);
      }}
      style={{
        flex: 1,
        minHeight: tokens.sizes.levelOption,
        borderRadius: tokens.radii.button,
        borderWidth: tokens.borderWidths.thin,
        borderColor: selected ? colors.primary : colors.borderChip,
        backgroundColor: selected ? colors.primary : colors.surface,
        alignItems: "center",
        paddingTop: tokens.spacing.s,
        paddingBottom: tokens.spacing.s6,
        paddingHorizontal: tokens.spacing.xs,
        gap: tokens.spacing.xs,
      }}
    >
      <Text variant="display" displaySize="displayLevelCard">
        {String(level)}
      </Text>
      <Text
        variant={selected ? "bodyStrong" : "muted"}
        style={{
          fontSize: tokens.fontSizes.caption,
          textAlign: "center",
          color: selected ? colors.onPrimary : colors.textMuted,
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/** "Como você se avalia?": five whole levels, a second tap clears; the admin confirms (ADR 0047). */
export function LevelPicker({ level, onPick }: LevelPickerProps) {
  const { colors, tokens } = useTheme();
  const { profile } = strings;
  return (
    <ProfileSection title={profile.levelTitle} note={profile.levelNote}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={profile.levelGroupLabel}
        style={{ flexDirection: "row", gap: tokens.spacing.s6 }}
      >
        {SELF_LEVEL_OPTIONS.map((option) => (
          <LevelOption
            key={option.level}
            option={option}
            selected={level === option.level}
            onPick={onPick}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.s6 }}>
        <LockIcon color={colors.textMuted} />
        <Text variant="muted" style={{ flex: 1, fontSize: tokens.fontSizes.caption }}>
          {profile.privacy}
        </Text>
      </View>
    </ProfileSection>
  );
}
