import { View } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { FLUSH, NET_MESH, NET_MESH_PATTERN_ID } from "../court.data";

const FULL = "100%";
const FILL = `url(#${NET_MESH_PATTERN_ID})`;

export interface NetMeshProps {
  /** `vertical` is the net of the landscape court: a strip as tall as its column, in the middle of it. */
  readonly orientation?: "horizontal" | "vertical";
}

/** The net: two crossing diagonal lines every 7 units, in the line color (QuadraSol.dc.html:34). */
export function NetMesh({ orientation = "horizontal" }: NetMeshProps) {
  const { colors, tokens } = useTheme();
  const { period, line } = NET_MESH;
  const thickness = tokens.court.sizes.netMesh;
  const vertical = orientation === "vertical";
  const mesh = (
    <Svg
      width={vertical ? thickness : FULL}
      height={vertical ? FULL : thickness}
      accessibilityElementsHidden
    >
      <Defs>
        <Pattern
          id={NET_MESH_PATTERN_ID}
          width={period}
          height={period}
          patternUnits="userSpaceOnUse"
        >
          <Line x1="0" y1={period} x2={period} y2="0" stroke={colors.text} strokeWidth={line} />
          <Line x1="0" y1="0" x2={period} y2={period} stroke={colors.text} strokeWidth={line} />
        </Pattern>
      </Defs>
      <Rect width={FULL} height={FULL} fill={FILL} />
    </Svg>
  );
  return vertical ? (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: FLUSH,
        bottom: FLUSH,
        left: FLUSH,
        right: FLUSH,
        alignItems: "center",
      }}
    >
      {mesh}
    </View>
  ) : (
    mesh
  );
}
