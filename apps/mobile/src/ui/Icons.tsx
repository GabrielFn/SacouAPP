import Svg, { Path } from "react-native-svg";

import { LOGO_ASPECT, LOGO_CELLS, LOGO_VIEW_BOX } from "../theme/logo.data";
import { iconStroke } from "../theme/tokens.data";
import { useTheme } from "../theme/theme-context";

export interface IconProps {
  readonly color?: string;
}

export interface LogoProps {
  readonly size: number;
}

const VIEW_BOX = "0 0 24 24";
const PLUS_PATH = "M12 5v14M5 12h14";
const CHECK_PATH = "M5 12.5l4.5 4.5L19 7.5";

export function PlusIcon({ color }: IconProps) {
  const { colors, tokens } = useTheme();
  return (
    <Svg
      width={tokens.sizes.plusIcon}
      height={tokens.sizes.plusIcon}
      viewBox={VIEW_BOX}
      fill="none"
    >
      <Path
        d={PLUS_PATH}
        stroke={color ?? colors.text}
        strokeWidth={iconStroke.plus}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CheckIcon({ color }: IconProps) {
  const { colors, tokens } = useTheme();
  return (
    <Svg
      width={tokens.sizes.checkIcon}
      height={tokens.sizes.checkIcon}
      viewBox={VIEW_BOX}
      fill="none"
    >
      <Path
        d={CHECK_PATH}
        stroke={color ?? colors.text}
        strokeWidth={iconStroke.check}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Logo({ size }: LogoProps) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size * LOGO_ASPECT} viewBox={LOGO_VIEW_BOX}>
      {LOGO_CELLS.map(({ key, d, highlight }) => (
        <Path key={key} d={d} fill={highlight ? colors.accent : colors.text} />
      ))}
    </Svg>
  );
}
