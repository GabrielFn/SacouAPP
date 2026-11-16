import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { loginColors } from "../../../theme/login-colors";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Logo } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

/** The round that brought the person here, when the web page opens the app (E4.16, after the pilot). */
export interface SignInContext {
  readonly line: string;
  readonly title: string;
}

export interface SignInHeroProps {
  /** `null` in the pilot: the top is the generic one (question 61). */
  readonly context: SignInContext | null;
}

/** The night top of screen 02: the brand, then the context of the round or the generic welcome. */
export function SignInHero({ context }: SignInHeroProps) {
  const { tokens } = useTheme();
  const { auth } = strings;
  const light = { color: loginColors.foreground };
  return (
    <View style={{ gap: tokens.spacing.xxxl }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={strings.appName}
        style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}
      >
        <Logo size={tokens.sizes.loginLogo} color={loginColors.foreground} />
        <Text
          style={{
            ...light,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.fontSizes.loginBrand,
          }}
        >
          {strings.appName}
        </Text>
      </View>
      <View style={{ gap: tokens.spacing.s6 }}>
        <Text style={{ color: loginColors.heroMuted }}>{context?.line ?? auth.heroBody}</Text>
        <Text variant="display" displaySize="displayTitleLarge" style={light}>
          {context?.title ?? auth.heroTitle}
        </Text>
      </View>
    </View>
  );
}
