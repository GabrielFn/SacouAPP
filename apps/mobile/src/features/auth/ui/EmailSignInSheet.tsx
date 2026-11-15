import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { SegmentedControl, type SegmentOption } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useEmailSignIn } from "../hooks/use-email-sign-in";
import { authFailureText } from "../model/auth-failure-text";
import type { EmailMode } from "../model/email-sign-in.reducer";
import {
  canSubmit,
  MAX_EMAIL_LENGTH,
  passwordTooShort,
  showsEmailError,
} from "../model/email-sign-in.selectors";

export interface EmailSignInSheetProps {
  readonly onClose: () => void;
}

const { emailSheet } = strings.auth;

const MODE_OPTIONS: readonly SegmentOption<EmailMode>[] = [
  { value: "signIn", label: emailSheet.signInTab },
  { value: "signUp", label: emailSheet.signUpTab },
];

const SUBMIT_LABEL: Readonly<Record<EmailMode, string>> = {
  signIn: emailSheet.signIn,
  signUp: emailSheet.signUp,
  reset: emailSheet.sendReset,
};

/**
 * The e-mail sheet (question 61, in the style of screen 30a). It is mounted only while open, so the
 * password never outlives it (ADR 0057, D5).
 */
export function EmailSignInSheet({ onClose }: EmailSignInSheetProps) {
  const model = useEmailSignIn(onClose);
  const { state } = model;
  const resetting = state.mode === "reset";
  const failure = authFailureText(state.failure);
  return (
    <BottomSheet
      visible
      title={resetting ? emailSheet.resetTitle : emailSheet.signInTitle}
      onClose={model.close}
    >
      {resetting ? (
        <Text variant="muted">{emailSheet.resetBody}</Text>
      ) : (
        <SegmentedControl
          options={MODE_OPTIONS}
          selected={state.mode}
          onSelect={model.changeMode}
          accessibilityLabel={emailSheet.modes}
          disabled={state.submitting}
        />
      )}
      <TextField
        label={emailSheet.emailLabel}
        value={state.email}
        onChangeText={model.changeEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={MAX_EMAIL_LENGTH}
        error={showsEmailError(state) ? emailSheet.emailInvalid : undefined}
      />
      {resetting ? null : (
        <TextField
          label={emailSheet.passwordLabel}
          value={state.password}
          onChangeText={model.changePassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={state.mode === "signUp" ? "new-password" : "password"}
          textContentType={state.mode === "signUp" ? "newPassword" : "password"}
          returnKeyType="go"
          onSubmitEditing={model.submit}
          help={state.mode === "signUp" ? emailSheet.passwordRule : undefined}
          error={passwordTooShort(state) && state.password !== "" ? emailSheet.passwordRule : undefined}
        />
      )}
      {failure === null ? null : (
        <Text variant="bodyStrong" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
      {state.resetSent ? (
        <Text variant="bodyStrong" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {emailSheet.resetSent}
        </Text>
      ) : null}
      <Button
        label={SUBMIT_LABEL[state.mode]}
        onPress={model.submit}
        disabled={!canSubmit(state)}
      />
      <Button
        variant="link"
        label={resetting ? emailSheet.backToSignIn : emailSheet.forgot}
        onPress={() => {
          model.changeMode(resetting ? "signIn" : "reset");
        }}
      />
    </BottomSheet>
  );
}
