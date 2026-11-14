import { useEffect, useState } from "react";
import { Animated } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies, palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { SET_POINT_PULSE_MS } from "../court.data";
import { useReducedMotion } from "../hooks/use-reduced-motion";

const PULSE_FROM = 0;
const PULSE_TO = 1;

/**
 * The yellow "Set point" tag. In the sun theme it has a black edge so it reads on white. It pulses
 * to the light yellow, unless the phone asks to reduce motion: then it stays still.
 */
export function SetPointTag() {
  const { colors, tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(PULSE_FROM));

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: PULSE_TO,
          duration: SET_POINT_PULSE_MS,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: PULSE_FROM,
          duration: SET_POINT_PULSE_MS,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(PULSE_FROM);
    };
  }, [reduced, pulse]);

  const backgroundColor = pulse.interpolate({
    inputRange: [PULSE_FROM, PULSE_TO],
    outputRange: [colors.accent, palette.ballYellowLight],
  });
  return (
    <Animated.View
      style={{
        height: sizes.tag,
        borderRadius: sizes.tag,
        justifyContent: "center",
        paddingHorizontal: tokens.spacing.m,
        backgroundColor,
        borderWidth: tokens.borderWidths.thick,
        borderColor: colors.serverOutline,
      }}
    >
      <Text
        style={{
          color: palette.black,
          fontFamily: fontFamilies.display800,
          fontSize: fontSizes.tag,
        }}
      >
        {strings.court.zone.setPointTag}
      </Text>
    </Animated.View>
  );
}
