import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { MinusIcon, PlusIcon } from "./Icons";
import { Text } from "./Text";

export interface StepperProps {
  readonly value: number;
  readonly unit: string;
  readonly lessLabel: string;
  readonly moreLabel: string;
  readonly canStepLess: boolean;
  readonly canStepMore: boolean;
  readonly onStep: (delta: number) => void;
}

const STEP = 1;
const DISABLED_OPACITY = 0.4;

export interface StepButtonProps {
  readonly label: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

function StepButton({ label, enabled, onPress, children }: StepButtonProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.sizes.minTouchTarget;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.text,
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : DISABLED_OPACITY,
      }}
    >
      {children}
    </Pressable>
  );
}

/** A number with a minus and a plus beside it (.stp/.mini/.num); the buttons turn off at the limits. */
export function Stepper({
  value,
  unit,
  lessLabel,
  moreLabel,
  canStepLess,
  canStepMore,
  onStep,
}: StepperProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: tokens.spacing.s10,
        marginTop: tokens.spacing.s,
      }}
    >
      <StepButton
        label={lessLabel}
        enabled={canStepLess}
        onPress={() => {
          onStep(-STEP);
        }}
      >
        <MinusIcon />
      </StepButton>
      <Text variant="display" displaySize="displayBlock" style={{ textAlign: "center" }}>
        {String(value)}
      </Text>
      <StepButton
        label={moreLabel}
        enabled={canStepMore}
        onPress={() => {
          onStep(STEP);
        }}
      >
        <PlusIcon />
      </StepButton>
      <Text variant="bodyStrong">{unit}</Text>
    </View>
  );
}
