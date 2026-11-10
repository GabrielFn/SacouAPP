import type { SettingsModality, SettingsTemplateKey } from "@sacou/match-engine";
import type { ReactNode } from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { palette } from "../../../theme/tokens.data";

const TEMPLATE_VIEW_BOX = "0 0 44 56";
const COURT_VIEW_BOX = "0 0 40 30";
const LINE_WIDTH = 2;
const NET_WIDTH = 3;

export interface TemplateIconProps {
  readonly templateKey: SettingsTemplateKey;
}

interface DrawingProps {
  readonly ink: string;
  readonly orange: string;
  readonly yellow: string;
  readonly blue: string;
}

function Court() {
  return (
    <>
      <Rect x="3" y="3" width="38" height="50" rx="2" />
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
      <Rect x="9" y="42" width="8" height="6" fill={orange} stroke="none" />
      <Rect x="18" y="42" width="8" height="6" fill={orange} stroke="none" />
      <Rect x="27" y="42" width="8" height="6" fill={orange} stroke="none" />
    </>
  );
}

function Treino({ blue, yellow }: DrawingProps) {
  return (
    <>
      <Court />
      <G fill={blue} stroke="none">
        <Rect x="8" y="33" width="7" height="6" />
        <Rect x="18.5" y="33" width="7" height="6" />
        <Rect x="29" y="33" width="7" height="6" />
        <Rect x="8" y="42" width="7" height="6" />
        <Rect x="18.5" y="42" width="7" height="6" />
      </G>
      <Rect x="29" y="42" width="7" height="6" fill={yellow} stroke="none" />
    </>
  );
}

function Areia({ yellow, ink }: DrawingProps) {
  return (
    <>
      <Rect x="0" y="0" width="44" height="56" rx="3" fill={palette.highlight} stroke="none" />
      <Rect x="5" y="5" width="34" height="46" rx="2" />
      <Line x1="5" y1="28" x2="39" y2="28" strokeWidth={NET_WIDTH} />
      <Path
        d="M15 15l3-4 4 4 4-4 3 4v4H15z"
        fill={yellow}
        stroke={ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </>
  );
}

function DoZero({ ink }: DrawingProps) {
  return <Path d="M22 14v28M8 28h28" stroke={ink} strokeWidth={NET_WIDTH} strokeLinecap="round" />;
}

const DRAWINGS: Readonly<Record<SettingsTemplateKey, (props: DrawingProps) => ReactNode>> = {
  pelada: Pelada,
  "racha-organizado": Racha,
  treino: Treino,
  "areia-rei-da-quadra": Areia,
  "do-zero": DoZero,
};

/** The small court of each template (CriarModelo.dc.html), drawn in the colors of the theme. */
export function TemplateIcon({ templateKey }: TemplateIconProps) {
  const { colors, tokens } = useTheme();
  const drawing = { ink: colors.text, orange: colors.primary, yellow: colors.accent, blue: colors.link };
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
  const indoor = modality === "indoor-6x6";
  return (
    <Svg
      width={tokens.sizes.courtIconWidth}
      height={tokens.sizes.courtIconHeight}
      viewBox={COURT_VIEW_BOX}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    >
      {indoor ? (
        <>
          <Rect x="1" y="1" width="38" height="28" />
          <Line x1="20" y1="1" x2="20" y2="29" strokeWidth={NET_WIDTH} stroke={colors.accent} />
          <Line x1="13" y1="1" x2="13" y2="29" />
          <Line x1="27" y1="1" x2="27" y2="29" />
        </>
      ) : (
        <>
          <Rect x="0" y="0" width="40" height="30" fill={palette.highlight} stroke="none" />
          <Rect x="3" y="3" width="34" height="24" />
          <Line x1="20" y1="3" x2="20" y2="27" strokeWidth={NET_WIDTH} />
        </>
      )}
    </Svg>
  );
}
