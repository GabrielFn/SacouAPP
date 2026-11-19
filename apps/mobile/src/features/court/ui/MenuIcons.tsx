import type { ReactNode } from "react";
import { Circle, Path, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { StrokeIcon, type IconProps } from "../../../ui/Icons";

/** The leading icons of the rows of the match menu, drawn as in MenuQuadra.dc.html. */
const MENU_STROKE_WIDTH = 2;

function MenuStroke({ color, children }: IconProps & { readonly children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.plusIcon} strokeWidth={MENU_STROKE_WIDTH}>
      {children}
    </StrokeIcon>
  );
}

export function LineupIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Rect x="4" y="3" width="16" height="18" rx="1" />
      <Path d="M4 15h16" />
      <Circle cx="9" cy="8" r="1.4" />
      <Circle cx="15" cy="8" r="1.4" />
      <Circle cx="12" cy="11.5" r="1.4" />
    </MenuStroke>
  );
}

export function SwapPlayersIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Path d="M7 4L3 8l4 4" />
      <Path d="M3 8h13" />
      <Path d="M17 20l4-4-4-4" />
      <Path d="M21 16H8" />
    </MenuStroke>
  );
}

export function TimelineIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </MenuStroke>
  );
}

export function FlipSidesIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Path d="M7 3v18" />
      <Path d="M3 7l4-4 4 4" />
      <Path d="M17 21V3" />
      <Path d="M21 17l-4 4-4-4" />
    </MenuStroke>
  );
}

export function ThemeIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5" />
    </MenuStroke>
  );
}

export function EndMatchIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Path d="M5 21V4" />
      <Path d="M5 4h12l-2 4 2 4H5" />
    </MenuStroke>
  );
}

export function LeaveCourtIcon({ color }: IconProps) {
  return (
    <MenuStroke color={color}>
      <Path d="M10 4H5v16h5" />
      <Path d="M15 8l4 4-4 4" />
      <Path d="M19 12H9" />
    </MenuStroke>
  );
}

/** The two quick actions of "Corrigir" (Corrigir.dc.html .qa), a size smaller than the rows. */
function QuickActionStroke({ color, children }: IconProps & { readonly children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.swapIcon} strokeWidth={MENU_STROKE_WIDTH}>
      {children}
    </StrokeIcon>
  );
}

export function SwitchServerIcon({ color }: IconProps) {
  return (
    <QuickActionStroke color={color}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3c-1.5 3-1.5 6 0 9s4.5 4.5 8.5 3.5M12 12c-3 .5-6 2.5-7.5 6" />
    </QuickActionStroke>
  );
}

export function RotateTeamIcon({ color }: IconProps) {
  return (
    <QuickActionStroke color={color}>
      <Path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <Path d="M20 4v4h-4" />
    </QuickActionStroke>
  );
}
