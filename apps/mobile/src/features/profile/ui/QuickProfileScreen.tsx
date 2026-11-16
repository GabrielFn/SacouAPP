import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { AppHeader } from "../../../ui/AppHeader";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { accountRoutes } from "../../account/navigation";
import { useQuickProfile, type QuickProfileMode } from "../hooks/use-quick-profile";
import { NICKNAME_FIELD_LIMIT } from "../model/nickname";
import type { ProfileFormState } from "../model/profile-form.reducer";
import { canSubmit, nicknameError, visibleOthers } from "../model/profile-form.selectors";
import { LevelPicker } from "./LevelPicker";
import { PositionChips } from "./PositionChips";

export interface QuickProfileScreenProps {
  readonly mode: QuickProfileMode;
  readonly initial: ProfileFormState;
  /** Edit mode goes back; on the first access the session gate leaves the screen. */
  readonly onSaved: () => void;
}

export interface QuickProfileFooterProps {
  readonly mode: QuickProfileMode;
  readonly disabled: boolean;
  /** A save in flight: "Pular" would queue a PUT that overwrites it with empty positions and level. */
  readonly saving: boolean;
  readonly onSubmit: () => void;
  readonly onSkip: () => void;
}

/** "Pular" (flex 1) and "Pronto" (flex 2) on the first access; only "Salvar" in edit mode. */
export function QuickProfileFooter({
  mode,
  disabled,
  saving,
  onSubmit,
  onSkip,
}: QuickProfileFooterProps) {
  const { tokens } = useTheme();
  const { profile } = strings;
  if (mode === "edit")
    return <Button label={profile.save} onPress={onSubmit} disabled={disabled} />;
  return (
    <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
      <View style={{ flex: 1 }}>
        <Button variant="link" label={profile.skip} onPress={onSkip} disabled={saving} />
      </View>
      <View style={{ flex: 2 }}>
        <Button label={profile.done} onPress={onSubmit} disabled={disabled} />
      </View>
    </View>
  );
}

export interface QuickProfileHeaderProps {
  readonly mode: QuickProfileMode;
}

/** The brand on the first access; the way back to the account in edit mode. */
function QuickProfileHeader({ mode }: QuickProfileHeaderProps) {
  if (mode === "onboarding") return <AppHeader />;
  return <BackBar title={strings.profile.title} fallbackHref={accountRoutes.account} />;
}

/** Screen 27, "Seu perfil de quadra" (Onboarding.dc.html). */
export function QuickProfileScreen({ mode, initial, onSaved }: QuickProfileScreenProps) {
  const model = useQuickProfile(initial, onSaved);
  const { tokens } = useTheme();
  const { profile } = strings;
  const { state, dispatch } = model;
  return (
    <Screen
      footer={
        <>
          {model.failure === null ? null : <ErrorStrip text={model.failure} />}
          <QuickProfileFooter
            mode={mode}
            disabled={!canSubmit(state) || model.saving}
            saving={model.saving}
            onSubmit={model.submit}
            onSkip={model.skip}
          />
        </>
      }
    >
      <QuickProfileHeader mode={mode} />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {profile.title}
        </Text>
        <Text variant="muted">{profile.subtitle}</Text>
      </View>
      <TextField
        label={profile.nicknameLabel}
        value={state.nickname}
        onChangeText={(text) => {
          dispatch({ type: "nickname-changed", text });
        }}
        autoCapitalize="words"
        autoComplete="nickname"
        maxLength={NICKNAME_FIELD_LIMIT}
        error={nicknameError(state) ?? undefined}
      />
      <PositionChips
        primary={state.primary}
        others={state.others}
        visibleOthers={visibleOthers(state)}
        onPickPrimary={(position) => {
          dispatch({ type: "primary-picked", position });
        }}
        onToggleOther={(position) => {
          dispatch({ type: "other-toggled", position });
        }}
      />
      <LevelPicker
        level={state.level}
        onPick={(level) => {
          dispatch({ type: "level-picked", level });
        }}
      />
    </Screen>
  );
}
