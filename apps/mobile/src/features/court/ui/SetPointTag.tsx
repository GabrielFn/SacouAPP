import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies, palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

/** The yellow "Set point" tag. In the sun theme it has a black edge so it reads on white. */
export function SetPointTag() {
  const { colors, tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  return (
    <View
      style={{
        height: sizes.tag,
        borderRadius: sizes.tag,
        alignSelf: "flex-start",
        justifyContent: "center",
        paddingHorizontal: tokens.spacing.m,
        backgroundColor: colors.accent,
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
    </View>
  );
}
