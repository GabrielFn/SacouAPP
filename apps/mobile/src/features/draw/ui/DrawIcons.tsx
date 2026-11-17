import { Path, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { StrokeIcon } from "../../../ui/Icons";

const STROKE = 2.2;
const LOCK_STROKE = 2.6;
// The body of the lock (Sorteio.dc.html): x 5, y 11, 14 by 9, corners of 2, in the 24 of the view box.
const LOCK_BODY = { x: 5, y: 11, width: 14, height: 9, radius: 2 } as const;
const LOCK_SHACKLE = "M8 11V8a4 4 0 0 1 8 0v3";

export interface DrawIconProps {
  readonly color: string;
}

/** The lock of a locked name, yellow on the night of the chip; the chip names it for the screen reader. */
export function ChipLockIcon({ color }: DrawIconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.lockIcon} strokeWidth={LOCK_STROKE}>
      <Rect
        x={LOCK_BODY.x}
        y={LOCK_BODY.y}
        width={LOCK_BODY.width}
        height={LOCK_BODY.height}
        rx={LOCK_BODY.radius}
      />
      <Path d={LOCK_SHACKLE} />
    </StrokeIcon>
  );
}

/** The lock of "Travar dupla". */
export function LockButtonIcon({ color }: DrawIconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.swapIcon} strokeWidth={STROKE}>
      <Rect
        x={LOCK_BODY.x}
        y={LOCK_BODY.y}
        width={LOCK_BODY.width}
        height={LOCK_BODY.height}
        rx={LOCK_BODY.radius}
      />
      <Path d={LOCK_SHACKLE} />
    </StrokeIcon>
  );
}

/** The two arrows of "Trocar". */
export function SwapIcon({ color }: DrawIconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.swapIcon} strokeWidth={STROKE}>
      <Path d="M7 4L3 8l4 4" />
      <Path d="M3 8h14" />
      <Path d="M17 20l4-4-4-4" />
      <Path d="M21 16H7" />
    </StrokeIcon>
  );
}
