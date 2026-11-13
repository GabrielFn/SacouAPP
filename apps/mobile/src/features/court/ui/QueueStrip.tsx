import { View, type TextStyle } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COURT_FLEX_WEIGHTS, LANDSCAPE_FLEX_WEIGHTS, MAX_QUEUE_PILLS } from "../court.data";
import type { CourtLayout } from "../model/court-layout";
import type { QueueModel } from "../model/court-screen.types";
import { queueExitText, queueLabel, visibleQueuePills } from "../model/screen-texts";
import { FlameIcon } from "./CourtIcons";
import { QueuePill } from "./QueuePill";

export interface QueueStripProps {
  readonly queue: QueueModel | null;
  /** "Laranja venceu 2 seguidas", or `null` with no streak. */
  readonly streak: string | null;
  readonly layout: CourtLayout;
}

/**
 * Who is waiting, the streak of the team that stays, and the rule of the exit. Upright it has two
 * lines; on its side it is a single row (the sketch of E4.17), with the rule at the right end.
 */
export function QueueStrip({ queue, streak, layout }: QueueStripProps) {
  const { colors, tokens } = useTheme();
  const landscape = layout.kind === "landscape";
  const textStyle: TextStyle = { color: colors.text, fontSize: tokens.fontSizes.small };
  const mutedStyle: TextStyle = { color: colors.textMuted, fontSize: tokens.fontSizes.caption };
  const exit = queueExitText(queue);
  const { shown, hidden } = visibleQueuePills(queue, MAX_QUEUE_PILLS);
  const waiting = (
    <View
      accessible={queue !== null}
      accessibilityLabel={queue === null ? undefined : queueLabel(queue)}
      style={{
        flexDirection: "row",
        flexWrap: landscape ? "nowrap" : "wrap",
        flexShrink: 1,
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
            <QueuePill
              key={key}
              position={index + 1}
              label={label}
              maxWidth={landscape ? layout.queuePillMaxWidth : undefined}
            />
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
  );
  const rule = (
    <>
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
    </>
  );
  return (
    <View
      style={{
        flex: landscape ? LANDSCAPE_FLEX_WEIGHTS.queue : COURT_FLEX_WEIGHTS.queue,
        justifyContent: landscape ? "center" : "space-between",
        borderTopWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.queueSurface,
        paddingTop: landscape ? undefined : tokens.spacing.s10,
        paddingHorizontal: tokens.spacing.l,
        paddingBottom: landscape ? undefined : tokens.spacing.m,
      }}
    >
      {landscape ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.l }}>
          {waiting}
          {rule}
        </View>
      ) : (
        <>
          {waiting}
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
            {rule}
          </View>
        </>
      )}
    </View>
  );
}
