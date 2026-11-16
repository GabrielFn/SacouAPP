import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";
import { loginColors } from "../../../theme/login-colors";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import { useSignInScreen } from "../hooks/use-sign-in-screen";
import { isBusy } from "../model/sign-in.reducer";
import { CourtBackdrop } from "./CourtBackdrop";
import { EmailSignInSheet } from "./EmailSignInSheet";
import { LegalLine } from "./LegalLine";
import { SignInButtons } from "./SignInButtons";
import { SignInHero } from "./SignInHero";

/** The handle of the sheet: 40 of the 390 of the canvas (Login.dc.html:40). */
const HANDLE_WIDTH = "10%";

/** Screen 02: the night court on top and the light sheet with the ways in (Login.dc.html). */
export function SignInScreen() {
  const model = useSignInScreen();
  const { legalLinks } = useServices();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = strings;
  const busy = isBusy(model.state);
  return (
    <View style={{ flex: 1, backgroundColor: loginColors.ground }}>
      <CourtBackdrop />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: insets.top + tokens.spacing.xxxl,
            paddingBottom: tokens.spacing.xxxl,
            paddingLeft: insets.left + tokens.spacing.xxl,
            paddingRight: insets.right + tokens.spacing.xxl,
          }}
        >
          <SignInHero context={null} />
        </View>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: tokens.radii.sheet,
            borderTopRightRadius: tokens.radii.sheet,
            paddingTop: tokens.spacing.m,
            paddingBottom: insets.bottom + tokens.spacing.xxxl,
            paddingLeft: insets.left + tokens.spacing.xl,
            paddingRight: insets.right + tokens.spacing.xl,
            gap: tokens.spacing.m,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: HANDLE_WIDTH,
              height: tokens.sizes.sheetHandle,
              borderRadius: tokens.sizes.sheetHandle,
              backgroundColor: colors.borderChip,
            }}
          />
          <Text
            accessibilityRole="header"
            style={{ fontSize: tokens.fontSizes.sheetTitle }}
            variant="title"
          >
            {auth.sheetTitle}
          </Text>
          <Text variant="muted" style={{ fontSize: tokens.fontSizes.body }}>
            {auth.sheetBody}
          </Text>
          {model.message === null ? null : (
            <Text variant="bodyStrong" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {model.message}
            </Text>
          )}
          <SignInButtons
            showsGoogle={model.showsGoogle}
            showsApple={model.showsApple}
            busy={busy}
            onSignIn={model.signIn}
            onEmail={model.openEmail}
          />
          <Text variant="caption" style={{ textAlign: "center" }}>
            {auth.privacy}
          </Text>
          <LegalLine links={legalLinks} onOpen={model.openLink} />
        </View>
      </ScrollView>
      {model.state.emailOpen ? <EmailSignInSheet onClose={model.closeEmail} /> : null}
    </View>
  );
}
