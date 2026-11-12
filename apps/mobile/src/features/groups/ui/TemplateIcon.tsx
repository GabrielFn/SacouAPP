import type { SettingsModality, SettingsTemplateKey } from "@sacou/match-engine";
import type { ReactNode } from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { palette } from "../../../theme/tokens.data";

const TEMPLATE_VIEW_BOX = "0 0 44 56";
const COURT_VIEW_BOX = "0 0 40 30";
const LINE_WIDTH = 2;
const COURT_LINE_WIDTH = 1.8;
const NET_WIDTH = 3;
const OUTLINE_WIDTH = 1.5;

export interface TemplateIconProps {
  readonly templateKey: SettingsTemplateKey;
}

export interface DrawingProps {
  readonly ink: string;
  readonly orange: string;
  readonly yellow: string;
  readonly blue: string;
}

function Court() {
  return (
    <>
      <Path d="M3 3h38v50H3z" />
      <Line x1="3" y1="28" x2="41" y2="28" strokeWidth={NET_WIDTH} />
    </>
  );
}

function Pelada({ yellow }: DrawingProps) {
  return (
    <>
      <Court />
      <Circle cx="22" cy="15" r="4" fill={yellow} stroke="none" />
    </>
  );
}

function Racha({ orange }: DrawingProps) {
  return (
    <>
      <Court />
      <Line x1="3" y1="19" x2="41" y2="19" />
      <Line x1="3" y1="37" x2="41" y2="37" />
      <Path d="M9 42h8v6H9z" fill={orange} stroke="none" />
      <Path d="M18 42h8v6H18z" fill={orange} stroke="none" />
      <Path d="M27 42h8v6H27z" fill={orange} stroke="none" />
    </>
  );
}

function Treino({ blue, yellow }: DrawingProps) {
  return (
    <>
      <Court />
      <G fill={blue} stroke="none">
        <Path d="M8 33h7v6H8z" />
        <Path d="M18.5 33h7v6h-7z" />
        <Path d="M29 33h7v6h-7z" />
        <Path d="M8 42h7v6H8z" />
        <Path d="M18.5 42h7v6h-7z" />
      </G>
      <Path d="M29 42h7v6h-7z" fill={yellow} stroke="none" />
    </>
  );
}

function Areia({ yellow, ink }: DrawingProps) {
  return (
    <>
      <Rect width="44" height="56" rx="3" fill={palette.highlight} stroke="none" />
      <Path d="M5 5h34v46H5z" />
      <Line x1="5" y1="28" x2="39" y2="28" strokeWidth={NET_WIDTH} />
      <Path
        d="M15 15l3-4 4 4 4-4 3 4v4H15z"
        fill={yellow}
        stroke={ink}
        strokeWidth={OUTLINE_WIDTH}
        strokeLinejoin="round"
      />
    </>
  );
}

function DoZero({ ink }: DrawingProps) {
  return <Path d="M22 14v28M8 28h28" stroke={ink} strokeWidth={NET_WIDTH} strokeLinecap="round" />;
}

type Drawings = Readonly<Record<SettingsTemplateKey, (props: DrawingProps) => ReactNode>>;

const DRAWINGS: Drawings = {
  pelada: Pelada,
  "racha-organizado": Racha,
  treino: Treino,
  "areia-rei-da-quadra": Areia,
  "do-zero": DoZero,
};

/** The small court of each template (CriarModelo.dc.html), drawn in the colors of the theme. */
export function TemplateIcon({ templateKey }: TemplateIconProps) {
  const { colors, tokens } = useTheme();
  const drawing: DrawingProps = {
    ink: colors.text,
    orange: colors.primary,
    yellow: colors.accent,
    blue: colors.link,
  };
  const Drawing = DRAWINGS[templateKey];
  return (
    <Svg
      width={tokens.sizes.templateIconWidth}
      height={tokens.sizes.templateIconHeight}
      viewBox={TEMPLATE_VIEW_BOX}
      fill="none"
      stroke={colors.text}
      strokeWidth={LINE_WIDTH}
    >
      <Drawing {...drawing} />
    </Svg>
  );
}

export interface CourtIconProps {
  readonly modality: SettingsModality;
  readonly color: string;
}

/** The court of the "Onde vocês jogam?" options: indoor with the yellow net, or sand. */
export function CourtIcon({ modality, color }: CourtIconProps) {
  const { colors, tokens } = useTheme();
  return (
    <Svg
      width={tokens.sizes.courtIconWidth}
      height={tokens.sizes.courtIconHeight}
      viewBox={COURT_VIEW_BOX}
      fill="none"
      stroke={color}
      strokeWidth={COURT_LINE_WIDTH}
    >
      {modality === "indoor-6x6" ? (
        <>
          <Path d="M1 1h38v28H1z" />
          <Line x1="20" y1="1" x2="20" y2="29" strokeWidth={NET_WIDTH} stroke={colors.accent} />
          <Line x1="13" y1="1" x2="13" y2="29" />
          <Line x1="27" y1="1" x2="27" y2="29" />
        </>
      ) : (
        <>
          <Rect width="40" height="30" fill={palette.highlight} stroke="none" />
          <Path d="M3 3h34v24H3z" />
          <Line x1="20" y1="3" x2="20" y2="27" strokeWidth={NET_WIDTH} />
        </>
      )}
    </Svg>
  );
}
