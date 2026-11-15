import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { loginColors } from "../../../theme/login-colors";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { SignInProvider } from "../model/sign-in.reducer";

export interface SignInButtonsProps {
  readonly showsGoogle: boolean;
  readonly showsApple: boolean;
  /** A login is pending or the e-mail sheet is open: every way in is off. */
  readonly busy: boolean;
  readonly onSignIn: (provider: SignInProvider) => void;
  readonly onEmail: () => void;
}

/** The white circle with the blue G of the Google button (Login.dc.html:43). */
function GoogleMark() {
  const { tokens } = useTheme();
  const side = tokens.sizes.googleBadge;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: side,
        aspectRatio: 1,
        borderRadius: side,
        backgroundColor: loginColors.googleBadge,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: loginColors.googleMark,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.button,
        }}
      >
        {strings.auth.googleMark}
      </Text>
    </View>
  );
}

/** Google (orange), Apple (dark, iOS only) and the link to the e-mail sheet. */
export function SignInButtons({
  showsGoogle,
  showsApple,
  busy,
  onSignIn,
  onEmail,
}: SignInButtonsProps) {
  const { colors, tokens } = useTheme();
  const { auth } = strings;
  return (
    <View style={{ gap: tokens.spacing.m }}>
      {showsGoogle ? (
        <Button
          label={auth.google}
          disabled={busy}
          onPress={() => {
            onSignIn("google");
          }}
          renderIcon={() => <GoogleMark />}
        />
      ) : null}
      {showsApple ? (
        <Button
          label={auth.apple}
          variant="secondary"
          disabled={busy}
          onPress={() => {
            onSignIn("apple");
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={auth.email}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onEmail}
        style={{ minHeight: tokens.sizes.linkButton, alignItems: "center", justifyContent: "center" }}
      >
        <Text
          style={{
            color: colors.text,
            fontFamily: fontFamilies.body600,
            fontSize: tokens.fontSizes.link,
            textDecorationLine: "underline",
          }}
        >
          {auth.email}
        </Text>
      </Pressable>
    </View>
  );
}
