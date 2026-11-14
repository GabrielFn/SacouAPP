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

export interface QueueTextStyles {
  readonly text: TextStyle;
  readonly muted: TextStyle;
}

export interface QueueWaitingProps extends QueueStripProps {
  readonly styles: QueueTextStyles;
}

/** "Na fila", the pills, the "+k" that did not fit and "reservas". */
function QueueWaiting({ queue, layout, styles }: QueueWaitingProps) {
  const { tokens } = useTheme();
  const landscape = layout.kind === "landscape";
  const { shown, hidden } = visibleQueuePills(queue, MAX_QUEUE_PILLS);
  return (
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
          <Text style={{ ...styles.text, fontFamily: fontFamilies.body700 }}>
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
            <Text style={{ ...styles.text, fontFamily: fontFamilies.body700 }}>
              {strings.court.queue.more(hidden)}
            </Text>
          )}
          {queue.players.length === 0 ? null : (
            <Text style={{ ...styles.muted, fontFamily: fontFamilies.body600 }}>
              {strings.court.queue.reserves}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

export interface QueueRuleProps {
  readonly queue: QueueModel | null;
  readonly streak: string | null;
  readonly styles: QueueTextStyles;
}

/** The streak of the team that stays and the rule of the exit, which sits at the right end. */
function QueueRule({ queue, streak, styles }: QueueRuleProps) {
  const { tokens } = useTheme();
  const exit = queueExitText(queue);
  return (
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
          <Text style={{ ...styles.text, fontFamily: fontFamilies.body600 }}>{streak}</Text>
        </View>
      )}
      {exit === null ? null : (
        <Text style={{ ...styles.muted, marginLeft: "auto", fontFamily: fontFamilies.body600 }}>
          {exit}
        </Text>
      )}
    </>
  );
}

/**
 * Who is waiting, the streak of the team that stays, and the rule of the exit. Upright it has two
 * lines; on its side it is a single row (the sketch of E4.17), with the rule at the right end.
 */
export function QueueStrip({ queue, streak, layout }: QueueStripProps) {
  const { colors, tokens } = useTheme();
  const landscape = layout.kind === "landscape";
  const styles: QueueTextStyles = {
    text: { color: colors.text, fontSize: tokens.fontSizes.small },
    muted: { color: colors.textMuted, fontSize: tokens.fontSizes.caption },
  };
  const waiting = <QueueWaiting queue={queue} streak={streak} layout={layout} styles={styles} />;
  const rule = <QueueRule queue={queue} streak={streak} styles={styles} />;
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
