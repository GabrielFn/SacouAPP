import { View, type TextStyle } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COURT_FLEX_WEIGHTS, MAX_QUEUE_PILLS } from "../court.data";
import type { QueueModel } from "../model/court-screen.types";
import { queueExitText, queueLabel, visibleQueuePills } from "../model/screen-texts";
import { FlameIcon } from "./CourtIcons";
import { QueuePill } from "./QueuePill";

export interface QueueStripProps {
  readonly queue: QueueModel | null;
  /** "Laranja venceu 2 seguidas", or `null` with no streak. */
  readonly streak: string | null;
}

/** Who is waiting, the streak of the team that stays, and the rule of the exit. */
export function QueueStrip({ queue, streak }: QueueStripProps) {
  const { colors, tokens } = useTheme();
  const textStyle: TextStyle = { color: colors.text, fontSize: tokens.fontSizes.small };
  const mutedStyle: TextStyle = { color: colors.textMuted, fontSize: tokens.fontSizes.caption };
  const exit = queueExitText(queue);
  const { shown, hidden } = visibleQueuePills(queue, MAX_QUEUE_PILLS);
  return (
    <View
      style={{
        flex: COURT_FLEX_WEIGHTS.queue,
        justifyContent: "space-between",
        borderTopWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.queueSurface,
        paddingTop: tokens.spacing.s10,
        paddingHorizontal: tokens.spacing.l,
        paddingBottom: tokens.spacing.m,
      }}
    >
      <View
        accessible={queue !== null}
        accessibilityLabel={queue === null ? undefined : queueLabel(queue)}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: tokens.spacing.s,
        }}
      >
        {queue === null ? null : (
          <>
            <Text style={{ ...textStyle, fontFamily: fontFamilies.body700 }}>
              {strings.court.queue.title}
            </Text>
            {shown.map(({ key, label }, index) => (
              <QueuePill key={key} position={index + 1} label={label} />
            ))}
            {hidden === 0 ? null : (
              <Text style={{ ...textStyle, fontFamily: fontFamilies.body700 }}>
                {strings.court.queue.more(hidden)}
              </Text>
            )}
            {queue.players.length === 0 ? null : (
              <Text style={{ ...mutedStyle, fontFamily: fontFamilies.body600 }}>
                {strings.court.queue.reserves}
              </Text>
            )}
          </>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
        {streak === null ? null : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.court.spacing.hairGap,
            }}
          >
            <FlameIcon />
            <Text style={{ ...textStyle, fontFamily: fontFamilies.body600 }}>{streak}</Text>
          </View>
        )}
        {exit === null ? null : (
          <Text style={{ ...mutedStyle, marginLeft: "auto", fontFamily: fontFamilies.body600 }}>
            {exit}
          </Text>
        )}
      </View>
    </View>
  );
}
