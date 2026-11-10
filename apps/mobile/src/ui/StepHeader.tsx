import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { BackIcon } from "./Icons";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface StepHeaderProps {
  readonly title: string;
  /** "Passo 1 de 2"; omitted on a screen without steps. */
  readonly progressLabel?: string;
  /** The share of the bar that is filled, from 0 to 1. */
  readonly progress?: number;
  readonly onBack: () => void;
}

const PERCENT = 100;

/** Back, title and step of the create-group screens (CriarModelo.dc.html header and bar). */
export function StepHeader({ title, progressLabel, progress, onBack }: StepHeaderProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <IconButton accessibilityLabel={strings.a11y.back} onPress={onBack}>
          <BackIcon />
        </IconButton>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </Text>
        {progressLabel !== undefined ? <Text variant="muted">{progressLabel}</Text> : null}
      </View>
      {progress !== undefined ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            height: tokens.sizes.progressBar,
            borderRadius: tokens.radii.field,
            backgroundColor: colors.borderCard,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flex: 1,
              width: `${String(Math.round(progress * PERCENT))}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
