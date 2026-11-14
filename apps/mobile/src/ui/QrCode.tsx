import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { QrMatrix } from "../services/qr/qr-encoder";
import { useTheme } from "../theme/theme-context";
import { qrLayout } from "../theme/tokens.data";

import { qrPath } from "./qr-path";

export interface QrCodeProps {
  /** Only the matrix comes in: the text it encodes (the token) never reaches the component. */
  readonly matrix: QrMatrix;
  readonly accessibilityLabel: string;
}

/** A QR in dark navy on white (ADR 0049, D7), its width a share of the screen and always square. */
export function QrCode({ matrix, accessibilityLabel }: QrCodeProps) {
  const { colors, tokens } = useTheme();
  const side = matrix.length + qrLayout.margin * 2;
  const viewBox = `0 0 ${String(side)} ${String(side)}`;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: qrLayout.width,
        aspectRatio: 1,
        alignSelf: "center",
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <Svg width="100%" height="100%" viewBox={viewBox} shapeRendering="crispEdges">
        <Rect width={side} height={side} fill={colors.surface} />
        <Path d={qrPath(matrix, qrLayout.margin)} fill={colors.text} />
      </Svg>
    </View>
  );
}
