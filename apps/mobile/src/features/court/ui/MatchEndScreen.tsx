import type { MemberId, TeamSide } from "@sacou/match-engine";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { EndRoundView } from "../end-round/end-round-view";
import type { ExitRows, ManualPick, ResultView } from "../next-match/match-end-selectors";
import { CourtPage } from "./CourtPage";
import { EndRoundDialog } from "./EndRoundDialog";
import { ExitList, PickList } from "./ExitList";
import { SIDE_LETTERS, TeamTag } from "./TeamTag";

export interface NextMatchView {
  readonly teams: Readonly<
    Record<TeamSide, { readonly label: string; readonly color: TeamColorName }>
  >;
  /** "(com Davi e Sofia)", or `null` with the same teams. */
  readonly with: string | null;
  readonly explanation: string;
  readonly rows: ExitRows;
  readonly picks: readonly ManualPick[];
  readonly chosen: Readonly<Record<TeamSide, readonly MemberId[]>>;
  readonly canConfirm: boolean;
}

/** The next-match column is a little wider than the result beside it (question 78). */
const NEXT_COLUMN_WEIGHT = 1.3;

export interface MatchEndScreenProps {
  readonly result: ResultView;
  /** `null` when the plan was turned down: the screen says so and offers only the way home. */
  readonly next: NextMatchView | null;
  readonly starting: boolean;
  readonly failure: string | null;
  readonly onToggle: (side: TeamSide, memberId: MemberId, required: number) => void;
  readonly onConfirm: () => void;
  readonly onLeave: () => void;
  /** "Encerrar rodada" under "Confirmar": ends the whole night (E4.12). */
  readonly endRound: EndRoundView;
  readonly onEndRound: () => void;
  readonly onConfirmEndRound: () => void;
  readonly onCancelEndRound: () => void;
}

export interface ResultColumnProps {
  readonly result: ResultView;
}

function ResultColumn({ result }: ResultColumnProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.xs }}>
      <Text variant="display" displaySize="displayTitle">
        {result.winnerText}
      </Text>
      <Text variant="display" displaySize="displayTitleLarge" tabular>
        {result.lastSet}
      </Text>
      <Text variant="bodyStrong">{result.sets}</Text>
      {result.streak === null ? null : <Text variant="muted">{result.streak}</Text>}
    </View>
  );
}

export interface NextHeaderProps {
  readonly next: NextMatchView;
}

function NextHeader({ next }: NextHeaderProps) {
  const { matchEnd } = strings.court;
  const { tokens } = useTheme();
  const tag = (side: TeamSide) => (
    <TeamTag
      color={next.teams[side].color}
      letter={SIDE_LETTERS[side]}
      label={next.teams[side].label}
    />
  );
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: tokens.spacing.s,
      }}
    >
      <Text variant="bodyStrong">{matchEnd.next}</Text>
      {tag("a")}
      <Text variant="muted">{matchEnd.versus}</Text>
      {tag("b")}
      {next.with === null ? null : <Text>{next.with}</Text>}
    </View>
  );
}

export interface ExitsBlockProps {
  readonly next: NextMatchView;
  readonly onToggle: MatchEndScreenProps["onToggle"];
}

function ExitsBlock({ next, onToggle }: ExitsBlockProps) {
  const { matchEnd } = strings.court;
  const { tokens } = useTheme();
  if (next.picks.length > 0) {
    return (
      <>
        {next.picks.map((pick) => (
          <PickList
            key={pick.side}
            pick={pick}
            chosen={next.chosen[pick.side]}
            onToggle={(memberId) => {
              onToggle(pick.side, memberId, pick.required);
            }}
          />
        ))}
      </>
    );
  }
  if (next.rows.leaving.length === 0) return null;
  return (
    <>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <ExitList title={matchEnd.leaves} rows={next.rows.leaving} />
        <ExitList title={matchEnd.enters} rows={next.rows.entering} />
      </View>
      {next.rows.swaps === null ? null : <Text variant="muted">{next.rows.swaps}</Text>}
    </>
  );
}

function NextColumn(props: MatchEndScreenProps) {
  const { matchEnd } = strings.court;
  const { colors, tokens } = useTheme();
  const { next } = props;
  return (
    <ScrollView
      style={{ flex: NEXT_COLUMN_WEIGHT }}
      contentContainerStyle={{ gap: tokens.spacing.s, paddingBottom: tokens.spacing.xl }}
    >
      {next === null ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {matchEnd.planFailed}
        </Text>
      ) : (
        <>
          <NextHeader next={next} />
          <Text>{next.explanation}</Text>
          <ExitsBlock next={next} onToggle={props.onToggle} />
          <Button
            label={matchEnd.confirm}
            disabled={!next.canConfirm || props.starting}
            onPress={props.onConfirm}
          />
        </>
      )}
      {props.failure === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {props.failure}
        </Text>
      )}
      <Button label={matchEnd.home} variant="outline" onPress={props.onLeave} />
      <Button
        label={matchEnd.endRound}
        variant="link"
        disabled={props.endRound.busy}
        onPress={props.onEndRound}
      />
      {props.endRound.failure === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {props.endRound.failure}
        </Text>
      )}
    </ScrollView>
  );
}

/**
 * Screen 11: how the match ended and the next one the queue proposes ("quem perde sai"). On its side,
 * two columns: the result and the next match (question 78).
 */
export function MatchEndScreen(props: MatchEndScreenProps) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return (
    <CourtPage title={props.result.heading} subtitle={null}>
      <View style={{ flex: 1, flexDirection: landscape ? "row" : "column", gap: tokens.spacing.l }}>
        <ResultColumn result={props.result} />
        <NextColumn {...props} />
      </View>
      <EndRoundDialog
        sheet={props.endRound.sheet}
        onConfirm={props.onConfirmEndRound}
        onCancel={props.onCancelEndRound}
      />
    </CourtPage>
  );
}
