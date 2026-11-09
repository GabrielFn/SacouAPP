import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { NET_MESH, NET_MESH_PATTERN_ID } from "../court.data";

const FULL = "100%";
const FILL = `url(#${NET_MESH_PATTERN_ID})`;

/** The net: two crossing diagonal lines every 7 units, in the line color (QuadraSol.dc.html:34). */
export function NetMesh() {
  const { colors, tokens } = useTheme();
  const { period, line } = NET_MESH;
  return (
    <Svg width={FULL} height={tokens.court.sizes.netMesh} accessibilityElementsHidden>
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
}
