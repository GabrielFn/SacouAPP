import Svg, { Defs, Line, Path, Pattern, Rect } from "react-native-svg";

import { loginColors } from "../../../theme/login-colors";
import {
  BACKDROP_ASPECT,
  BACKDROP_ATTACK_LINES_Y,
  BACKDROP_COURT,
  BACKDROP_LINE_WIDTH,
  BACKDROP_MESH,
  BACKDROP_NET_WIDTH,
  BACKDROP_NET_Y,
  BACKDROP_VIEW_BOX,
} from "./court-backdrop.data";

/** Flush with the top left corner of the screen. */
const FLUSH = 0;
const MESH_ID = "login-net-mesh";
const LEFT = BACKDROP_COURT.x;
const RIGHT = BACKDROP_COURT.x + BACKDROP_COURT.width;
const CELL = BACKDROP_MESH.cell;

/** The court lines and the net behind the login: decoration only, hidden from the screen reader. */
export function CourtBackdrop() {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      viewBox={BACKDROP_VIEW_BOX}
      width="100%"
      style={{ position: "absolute", top: FLUSH, left: FLUSH, aspectRatio: 1 / BACKDROP_ASPECT }}
      fill="none"
    >
      <Defs>
        <Pattern id={MESH_ID} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <Path
            d={`M0 0L${String(CELL)} ${String(CELL)}M${String(CELL)} 0L0 ${String(CELL)}`}
            stroke={loginColors.mesh}
            strokeWidth={BACKDROP_MESH.stroke}
          />
        </Pattern>
      </Defs>
      <Rect
        {...BACKDROP_COURT}
        stroke={loginColors.courtLine}
        strokeWidth={BACKDROP_LINE_WIDTH}
      />
      {BACKDROP_ATTACK_LINES_Y.map((y) => (
        <Line
          key={y}
          x1={LEFT}
          y1={y}
          x2={RIGHT}
          y2={y}
          stroke={loginColors.courtLine}
          strokeWidth={BACKDROP_LINE_WIDTH}
        />
      ))}
      <Rect
        x={LEFT}
        y={BACKDROP_MESH.y}
        width={BACKDROP_COURT.width}
        height={BACKDROP_MESH.height}
        fill={`url(#${MESH_ID})`}
      />
      <Line
        x1={LEFT}
        y1={BACKDROP_NET_Y}
        x2={RIGHT}
        y2={BACKDROP_NET_Y}
        stroke={loginColors.net}
        strokeWidth={BACKDROP_NET_WIDTH}
      />
    </Svg>
  );
}
