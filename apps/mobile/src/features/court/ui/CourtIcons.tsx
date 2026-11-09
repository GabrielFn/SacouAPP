import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { palette } from "../../../theme/tokens.data";

// Paths and strokes from QuadraSol.dc.html, on the 24 x 24 view box of the design.
const VIEW_BOX = "0 0 24 24";
const STROKE_THIN = 1.6;
const STROKE_BALL = 2;
const STROKE_ICON = 2.4;
const STROKE_SAVED = 2.2;

export interface CourtIconProps {
  readonly color?: string;
}

export function CloudOffIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.savedIcon;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
      <Path
        d="M3 3l18 18M8.5 8.5A5 5 0 0 0 6 18h11"
        stroke={color ?? colors.textMuted}
        strokeWidth={STROKE_SAVED}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MenuDotsIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.menuIcon;
  const fill = color ?? colors.text;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} fill={fill}>
      <Circle cx="5" cy="12" r="2.2" />
      <Circle cx="12" cy="12" r="2.2" />
      <Circle cx="19" cy="12" r="2.2" />
    </Svg>
  );
}

export function LockIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.lockIcon;
  const stroke = color ?? colors.text;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none" stroke={stroke}>
      <Path d="M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" strokeWidth={STROKE_ICON} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth={STROKE_ICON} />
    </Svg>
  );
}

export function UndoIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.undoIcon;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
      <Path
        d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"
        stroke={color ?? colors.background}
        strokeWidth={STROKE_ICON}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PencilIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.correctIcon;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
      <Path
        d="M4 20h4L19 9l-4-4L4 16z"
        stroke={color ?? colors.text}
        strokeWidth={STROKE_ICON}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FlameIcon({ color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.court.sizes.flameIcon;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      <Path
        d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1.5 1 2 2 2 3 1-2 1-4 1-7z"
        fill={palette.serveOrange}
        stroke={color ?? colors.text}
        strokeWidth={STROKE_THIN}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BallIcon() {
  const { tokens } = useTheme();
  const size = tokens.court.sizes.ballIcon;
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      <Circle
        cx="12"
        cy="12"
        r="9"
        fill={palette.white}
        stroke={palette.black}
        strokeWidth={STROKE_BALL}
      />
      <Path
        d="M12 3c-1.5 3-1.5 6 0 9s4.5 4.5 8.5 3.5M12 12c-3 .5-6 2.5-7.5 6"
        fill="none"
        stroke={palette.black}
        strokeWidth={STROKE_BALL}
      />
    </Svg>
  );
}
