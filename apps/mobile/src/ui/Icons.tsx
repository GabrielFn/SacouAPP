import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

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
const MINUS_PATH = "M5 12h14";
const CHECK_PATH = "M5 12.5l4.5 4.5L19 7.5";
const NAV_STROKE_WIDTH = 2;
const HEADER_STROKE_WIDTH = 2.2;

export interface StrokeIconProps extends IconProps {
  readonly size: number;
  readonly strokeWidth: number;
  readonly children: ReactNode;
}

function StrokeIcon({ color, size, strokeWidth, children }: StrokeIconProps) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      fill="none"
      stroke={color ?? colors.text}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Icons of the bottom bar and the headers, drawn as in Grupos.dc.html and Notificacoes.dc.html. */
export function HomeIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.tabIcon} strokeWidth={NAV_STROKE_WIDTH}>
      <Path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
    </StrokeIcon>
  );
}

export function GroupIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.tabIcon} strokeWidth={NAV_STROKE_WIDTH}>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <Path d="M18 14a6 6 0 0 1 3.5 6" />
    </StrokeIcon>
  );
}

export function PersonIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.tabIcon} strokeWidth={NAV_STROKE_WIDTH}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </StrokeIcon>
  );
}

export function BellIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.tabIcon} strokeWidth={HEADER_STROKE_WIDTH}>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 21h4" />
    </StrokeIcon>
  );
}

export function BackIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.backIcon} strokeWidth={HEADER_STROKE_WIDTH}>
      <Path d="M15 5l-7 7 7 7" />
    </StrokeIcon>
  );
}

function CrossIcon({ color, path }: IconProps & { readonly path: string }) {
  const { colors, tokens } = useTheme();
  return (
    <Svg
      width={tokens.sizes.plusIcon}
      height={tokens.sizes.plusIcon}
      viewBox={VIEW_BOX}
      fill="none"
    >
      <Path
        d={path}
        stroke={color ?? colors.text}
        strokeWidth={iconStroke.plus}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlusIcon({ color }: IconProps) {
  return <CrossIcon color={color} path={PLUS_PATH} />;
}

export function MinusIcon({ color }: IconProps) {
  return <CrossIcon color={color} path={MINUS_PATH} />;
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

const CHEVRON_STROKE_WIDTH = 2.2;

export interface ChevronProps extends IconProps {
  readonly path: string;
}

function Chevron({ color, path }: ChevronProps) {
  const { colors, tokens } = useTheme();
  return (
    <StrokeIcon
      color={color ?? colors.textMuted}
      size={tokens.sizes.chevronIcon}
      strokeWidth={CHEVRON_STROKE_WIDTH}
    >
      <Path d={path} />
    </StrokeIcon>
  );
}

export function ChevronDownIcon({ color }: IconProps) {
  return <Chevron color={color} path="M6 9l6 6 6-6" />;
}

export function ChevronRightIcon({ color }: IconProps) {
  return <Chevron color={color} path="M9 6l6 6-6 6" />;
}

/** The "⋯" of a member row (Membros.dc.html .more): three filled dots. */
export function MoreIcon({ color }: IconProps) {
  const { colors, tokens } = useTheme();
  const fill = color ?? colors.textMuted;
  return (
    <Svg width={tokens.sizes.chevronIcon} height={tokens.sizes.chevronIcon} viewBox={VIEW_BOX}>
      <Circle cx="5" cy="12" r="2" fill={fill} />
      <Circle cx="12" cy="12" r="2" fill={fill} />
      <Circle cx="19" cy="12" r="2" fill={fill} />
    </Svg>
  );
}

export function LinkIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.chevronIcon} strokeWidth={HEADER_STROKE_WIDTH}>
      <Path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <Path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </StrokeIcon>
  );
}

export function QrIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.chevronIcon} strokeWidth={NAV_STROKE_WIDTH}>
      <Rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
      <Rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
      <Rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
      <Path d="M14 14h3v3h-3zM17.5 17.5h3v3h-3z" />
    </StrokeIcon>
  );
}
