import { useRef, type RefObject } from "react";
import type { TextInput } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { SegmentedControl, type SegmentOption } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useEmailSignIn, type EmailSignInModel } from "../hooks/use-email-sign-in";
import { authFailureText } from "../model/auth-failure-text";
import type { EmailMode } from "../model/email-sign-in.reducer";
import {
  canSubmit,
  MAX_EMAIL_LENGTH,
  showsEmailError,
  showsModeLink,
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

export interface SheetAlertProps {
  readonly text: string | null;
}

/** A refusal or a confirmation, read aloud as it appears. */
function SheetAlert({ text }: SheetAlertProps) {
  if (text === null) return null;
  return (
    <Text variant="bodyStrong" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

export interface PasswordFieldProps {
  readonly model: EmailSignInModel;
  readonly inputRef: RefObject<TextInput | null>;
}

/** The password, filled by the password manager; a new one when creating the account. */
function PasswordField({ model, inputRef }: PasswordFieldProps) {
  const creating = model.state.mode === "signUp";
  return (
    <TextField
      label={emailSheet.passwordLabel}
      value={model.state.password}
      onChangeText={model.changePassword}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={creating ? "new-password" : "password"}
      textContentType={creating ? "newPassword" : "password"}
      inputRef={inputRef}
      returnKeyType="go"
      onSubmitEditing={model.submit}
      help={creating ? emailSheet.passwordRule : undefined}
    />
  );
}

/**
 * The e-mail sheet (question 61, in the style of screen 30a). It is mounted only while open, so the
 * password never outlives it (ADR 0057, D5).
 */
export function EmailSignInSheet({ onClose }: EmailSignInSheetProps) {
  const model = useEmailSignIn(onClose);
  const { state } = model;
  const passwordRef = useRef<TextInput>(null);
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
        returnKeyType={resetting ? "go" : "next"}
        submitBehavior={resetting ? "blurAndSubmit" : "submit"}
        onSubmitEditing={resetting ? model.submit : () => passwordRef.current?.focus()}
        error={showsEmailError(state) ? emailSheet.emailInvalid : undefined}
      />
      {resetting ? null : <PasswordField model={model} inputRef={passwordRef} />}
      <SheetAlert text={failure} />
      <SheetAlert text={state.resetSent ? emailSheet.resetSent : null} />
      <Button
        label={SUBMIT_LABEL[state.mode]}
        onPress={model.submit}
        disabled={!canSubmit(state)}
      />
      {showsModeLink(state) ? (
        <Button
          variant="link"
          label={resetting ? emailSheet.backToSignIn : emailSheet.forgot}
          disabled={state.submitting}
          onPress={() => {
            model.changeMode(resetting ? "signIn" : "reset");
          }}
        />
      ) : null}
    </BottomSheet>
  );
}
