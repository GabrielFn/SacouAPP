import type { TeamSide } from "@sacou/match-engine";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { SetEndModel } from "../model/court-screen.types";
import type { SetEndView } from "../model/set-end-view";
import { CourtPage } from "./CourtPage";
import { FirstServerToss } from "./FirstServerToss";
import { TeamTag } from "./TeamTag";

const LETTERS: Readonly<Record<TeamSide, string>> = { a: "A", b: "B" };

export interface SetEndSheetProps {
  readonly model: SetEndModel;
  readonly view: SetEndView;
  readonly colors: Readonly<Record<TeamSide, TeamColorName>>;
  readonly toss: TeamSide | null;
  readonly canConfirm: boolean;
  /** Why the last command did nothing, or `null`. */
  readonly refusal: string | null;
  readonly onChooseToss: (side: TeamSide) => void;
  readonly onDrawToss: () => void;
  readonly onUndo: () => void;
  readonly onConfirm: () => void;
}

function TeamScore({
  model,
  colors,
  side,
}: Pick<SetEndSheetProps, "model" | "colors"> & {
  readonly side: TeamSide;
}) {
  const { tokens } = useTheme();
  const { label, score } = model.scores[side];
  return (
    <View style={{ flex: 1, alignItems: "center", gap: tokens.spacing.xs }}>
      <TeamTag color={colors[side]} letter={LETTERS[side]} label={label} />
      <Text variant="display" displaySize="displayTitleLarge" tabular>
        {String(score)}
      </Text>
    </View>
  );
}

/** "A Laranja 25 x 22 B Azul", read as one line. */
function ScoreCard({ model, colors }: Pick<SetEndSheetProps, "model" | "colors">) {
  const { setEnd } = strings.court;
  const { colors: theme, tokens } = useTheme();
  const { a, b } = model.scores;
  return (
    <View
      accessible
      accessibilityLabel={setEnd.scoreLabel(a.label, a.score, b.label, b.score)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: theme.borderCard,
        backgroundColor: theme.surface,
      }}
    >
      <TeamScore model={model} colors={colors} side="a" />
      <Text variant="muted">{setEnd.versus}</Text>
      <TeamScore model={model} colors={colors} side="b" />
    </View>
  );
}

function NextColumn(props: SetEndSheetProps) {
  const { setEnd } = strings.court;
  const { colors } = useTheme();
  const { model, view } = props;
  return (
    <>
      <Text variant="bodyStrong">{view.next.text}</Text>
      {model.needsFirstServer ? (
        <FirstServerToss
          labels={{ a: model.scores.a.label, b: model.scores.b.label }}
          toss={props.toss}
          onChoose={props.onChooseToss}
          onDraw={props.onDrawToss}
        />
      ) : null}
      {view.canUndo ? (
        <Button label={setEnd.undo} variant="outline" onPress={props.onUndo} />
      ) : null}
      <Button label={view.confirmLabel} disabled={!props.canConfirm} onPress={props.onConfirm} />
      {props.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {props.refusal}
        </Text>
      )}
    </>
  );
}

/**
 * Screen 25: the decided set and what confirming it does. There is no "Voltar": the court would turn
 * every point down (pendência 31), so the way back is "Desfazer último ponto". On its side, two columns.
 */
export function SetEndSheet(props: SetEndSheetProps) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return (
    <CourtPage title={props.view.title} subtitle={null}>
      <View style={{ flex: 1, flexDirection: landscape ? "row" : "column", gap: tokens.spacing.l }}>
        <View style={{ flex: 1, gap: tokens.spacing.s }}>
          <ScoreCard model={props.model} colors={props.colors} />
          <Text>{props.view.outcome}</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: tokens.spacing.s, paddingBottom: tokens.spacing.xl }}
        >
          <NextColumn {...props} />
        </ScrollView>
      </View>
    </CourtPage>
  );
}
