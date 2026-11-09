import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { scoreTextSize, type ScoreSizeInput } from "../model/score-display";

export interface ScoreNumberProps extends ScoreSizeInput {
  readonly color: string;
}

/**
 * The score has no ceiling. Its size comes from the height of the zone (not from the font scale of
 * the system, which would push it out of the zone), and it never wraps.
 */
export function ScoreNumber({ color, ...input }: ScoreNumberProps) {
  const { fontSize, lineHeight, letterSpacing } = scoreTextSize(input);
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      allowFontScaling={false}
      tabular
      style={{ color, fontFamily: fontFamilies.display800, fontSize, lineHeight, letterSpacing }}
    >
      {input.score}
    </Text>
  );
}
