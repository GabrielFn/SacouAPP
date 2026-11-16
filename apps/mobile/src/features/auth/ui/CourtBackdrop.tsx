import Svg, { Defs, Line, Path, Pattern } from "react-native-svg";

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
const CELL = String(BACKDROP_MESH.cell);

/** A rectangle as a path: `Rect` takes its corner through props that the SVG types mark deprecated. */
function boxPath(x: number, y: number, width: number, height: number): string {
  return `M${String(x)} ${String(y)}h${String(width)}v${String(height)}h${String(-width)}z`;
}

const COURT_PATH = boxPath(LEFT, BACKDROP_COURT.y, BACKDROP_COURT.width, BACKDROP_COURT.height);
const MESH_PATH = boxPath(LEFT, BACKDROP_MESH.y, BACKDROP_COURT.width, BACKDROP_MESH.height);
const MESH_CROSS = `M0 0L${CELL} ${CELL}M${CELL} 0L0 ${CELL}`;

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
        <Pattern
          id={MESH_ID}
          width={BACKDROP_MESH.cell}
          height={BACKDROP_MESH.cell}
          patternUnits="userSpaceOnUse"
        >
          <Path d={MESH_CROSS} stroke={loginColors.mesh} strokeWidth={BACKDROP_MESH.stroke} />
        </Pattern>
      </Defs>
      <Path d={COURT_PATH} stroke={loginColors.courtLine} strokeWidth={BACKDROP_LINE_WIDTH} />
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
      <Path d={MESH_PATH} fill={`url(#${MESH_ID})`} />
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
