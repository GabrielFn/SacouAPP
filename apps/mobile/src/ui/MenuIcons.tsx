import { Path } from "react-native-svg";

import { useTheme } from "../theme/theme-context";
import { NAV_STROKE_WIDTH, StrokeIcon, type IconProps } from "./Icons";

export interface MenuIconProps extends IconProps {
  readonly paths: readonly string[];
}

/** The icons of the rows of the account (Conta.dc.html, "Mais"), 20 of the canvas, stroke 2. */
function MenuIcon({ color, paths }: MenuIconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.chevronIcon} strokeWidth={NAV_STROKE_WIDTH}>
      {paths.map((path) => (
        <Path key={path} d={path} />
      ))}
    </StrokeIcon>
  );
}

const DOCUMENT = ["M7 3h8l4 4v14H7z", "M10 12h6M10 16h6"];
const SHIELD = ["M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"];
const SIGN_OUT = ["M14 4h5v16h-5", "M10 8l-4 4 4 4", "M6 12h10"];
const DOWNLOAD = ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"];
const GEAR = [
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
];

export function DocumentIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={DOCUMENT} />;
}

export function ShieldIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={SHIELD} />;
}

/** "Exportar meus dados" (Conta.dc.html). */
export function DownloadIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={DOWNLOAD} />;
}

export function SignOutIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={SIGN_OUT} />;
}

/** The gear of the "Conta" row of the "Eu" tab, until screen 14 has it in its header (E4.8). */
export function GearIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={GEAR} />;
}

const SHARE = ["M12 3v12", "M7 8l5-5 5 5", "M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"];

/** "Compartilhar" of screen 14 (Perfil.dc.html). */
export function ShareIcon({ color }: IconProps) {
  return <MenuIcon color={color} paths={SHARE} />;
}
