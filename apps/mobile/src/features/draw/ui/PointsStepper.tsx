import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { MinusIcon, PlusIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { PointsView } from "../model/pre-game-selectors";

const STEP = 1;
const DISABLED_OPACITY = 0.4;

export interface PointsStepperProps {
  readonly label: string;
  readonly lessLabel: string;
  readonly moreLabel: string;
  readonly view: PointsView;
  readonly onStep: (delta: number) => void;
}

export interface StepTargetProps {
  readonly label: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

/** A minus or a plus of the white box (PreJogo.dc.html): no ring, off and dimmed at a limit. */
function StepTarget({ label, enabled, onPress, children }: StepTargetProps) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{
        minWidth: tokens.sizes.iconButton,
        minHeight: tokens.sizes.iconButton,
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : DISABLED_OPACITY,
      }}
    >
      {children}
    </Pressable>
  );
}

/** "Pontos por set" with "−" and "+" in a white box; the limits come from the catalog (D6). */
export function PointsStepper({ label, lessLabel, moreLabel, view, onStep }: PointsStepperProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.m }}>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
          backgroundColor: colors.surface,
          borderRadius: tokens.radii.button,
          borderWidth: tokens.borderWidths.thin,
          borderColor: colors.borderCard,
        }}
      >
        <StepTarget
          label={lessLabel}
          enabled={view.canLess}
          onPress={() => {
            onStep(-STEP);
          }}
        >
          <MinusIcon />
        </StepTarget>
        <Text
          variant="display"
          accessibilityLiveRegion="polite"
          style={{ fontSize: tokens.fontSizes.displayLevelCard, textAlign: "center" }}
        >
          {String(view.value)}
        </Text>
        <StepTarget
          label={moreLabel}
          enabled={view.canMore}
          onPress={() => {
            onStep(STEP);
          }}
        >
          <PlusIcon />
        </StepTarget>
      </View>
    </View>
  );
}
