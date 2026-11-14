import { useRouter, type Href } from "expo-router";
import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { BackIcon } from "./Icons";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface BackBarProps {
  readonly title: string;
  /** Where "Voltar" goes when there is nothing to go back to (a screen opened from a link). */
  readonly fallbackHref: Href;
  /** `heading` is the big title of the screen; `label` a small line beside the button. */
  readonly look?: "heading" | "label";
}

/** The back button with the title of the screen beside it. */
export function BackBar({ title, fallbackHref, look = "label" }: BackBarProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <IconButton
        accessibilityLabel={strings.a11y.back}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(fallbackHref);
        }}
      >
        <BackIcon />
      </IconButton>
      {look === "heading" ? (
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <Text variant="bodyStrong">{title}</Text>
      )}
    </View>
  );
}
