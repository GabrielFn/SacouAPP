import type { BestOf, GroupSettings, TeamSide } from "@sacou/match-engine";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { SegmentBar } from "../../../ui/SegmentBar";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import type { RoundCourtRead } from "../../court/hooks/use-round-court";
import type { RoundCourt } from "../../court/session/round-court";
import type { DrawScreenModel } from "../hooks/use-draw-screen";
import { usePreGame, type PreGameModel } from "../hooks/use-pre-game";
import type { DrawArrangement } from "../model/draw-arrangement";
import {
  firstServerOptions,
  matchNumber,
  pointsView,
  rotationView,
  setsView,
  sideIdentity,
  startBlocker,
  tieBreakLine,
} from "../model/pre-game-selectors";
import { startBlockerText, startErrorText } from "../model/pre-game-texts";
import { PointsStepper } from "./PointsStepper";
import { RotationPicker } from "./RotationPicker";
import { teamSwatch } from "./team-swatch";

const { preGame: texts } = strings.draw;

export interface PreGameSheetProps {
  readonly groupId: string;
  readonly roundId: string;
  readonly model: DrawScreenModel;
  readonly arrangement: DrawArrangement;
  readonly settings: GroupSettings;
  /** How many of the draw left the list since: someone gone keeps the start off (D4). */
  readonly leftSinceDraw: number;
}

function courtOf(read: RoundCourtRead): RoundCourt | null {
  return read.status === "read" ? read.court : null;
}

export interface TeamTagProps {
  readonly side: TeamSide;
}

/** "A Laranja" on the white card with its color strip; only shown in the pilot (D6). */
function TeamTag({ side }: TeamTagProps) {
  const { colors, tokens } = useTheme();
  const team = sideIdentity(side);
  const swatch = teamSwatch(team.color, colors);
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        minHeight: tokens.sizes.blockHeaderMin,
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.button,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: tokens.sizes.teamStrip,
          alignSelf: "stretch",
          backgroundColor: swatch.fill,
        }}
      />
      <View
        style={{
          width: tokens.sizes.teamBadge,
          aspectRatio: 1,
          borderRadius: tokens.radii.playerChip,
          backgroundColor: swatch.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="display" style={{ color: swatch.onFill }}>
          {team.letter}
        </Text>
      </View>
      <Text variant="display" style={{ flexShrink: 1, fontSize: tokens.fontSizes.teamTitle }}>
        {team.name}
      </Text>
    </View>
  );
}

function Teams() {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <TeamTag side="a" />
      <Text variant="muted">{texts.versus}</Text>
      <TeamTag side="b" />
    </View>
  );
}

export interface SectionProps {
  readonly pre: PreGameModel;
  readonly model: DrawScreenModel;
}

function SetsSection({ pre, model }: SectionProps) {
  const { tokens } = useTheme();
  const sets = setsView(pre.input);
  const tieBreak = tieBreakLine(pre.input);
  const base = pre.input.settings.scoring.bestOf;
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong">{texts.sets}</Text>
      <SegmentedControl<BestOf>
        options={sets.options}
        selected={sets.selected}
        accessibilityLabel={texts.sets}
        onSelect={(bestOf) => {
          model.dispatch({ type: "best-of-chosen", bestOf, base });
        }}
      />
      {tieBreak === null ? null : <Text variant="muted">{tieBreak}</Text>}
    </View>
  );
}

function ServerSection({ pre, model }: SectionProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong">{texts.firstServer}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <SegmentedControl<TeamSide>
            options={firstServerOptions(pre.input, model.nameOf)}
            selected={pre.input.preGame.firstServer}
            accessibilityLabel={texts.firstServer}
            onSelect={(side) => {
              model.dispatch({ type: "first-server-chosen", side });
            }}
          />
        </View>
        <Button label={texts.flip} variant="outline" onPress={pre.flip} />
      </View>
    </View>
  );
}

function RotationSection({ pre, model }: SectionProps) {
  const { tokens } = useTheme();
  const view = rotationView(pre.input, model.nameOf);
  if (view === null) return null;
  const base = pre.input.settings.rotation.system;
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Text variant="bodyStrong">{texts.rotation}</Text>
      <SegmentBar<TeamSide>
        role="tabs"
        options={view.tabs.map((tab) => ({ value: tab.side, label: tab.label }))}
        selected={view.side}
        accessibilityLabel={texts.rotation}
        onSelect={(side) => {
          model.dispatch({ type: "rotation-tab-chosen", side });
        }}
      />
      {view.picker === null ? null : (
        <>
          <RotationPicker
            label={texts.rotationGroup(view.team.name)}
            options={view.picker.options}
            selected={view.picker.system}
            disabled={pre.starting}
            onSelect={(system) => {
              model.dispatch({ type: "system-chosen", side: view.side, system, base });
            }}
          />
          <Text variant="body">{view.picker.setterLine}</Text>
        </>
      )}
      <Text variant="muted">{view.benchLine}</Text>
    </View>
  );
}

export interface StartButtonProps {
  readonly pre: PreGameModel;
  readonly leftSinceDraw: number;
}

function StartButton({ pre, leftSinceDraw }: StartButtonProps) {
  const blocker = startBlocker(leftSinceDraw, courtOf(pre.court));
  const reading = pre.court.status === "reading";
  return (
    <>
      {blocker === null ? null : <ErrorStrip text={startBlockerText(blocker)} />}
      {pre.startError === null ? null : <ErrorStrip text={startErrorText(pre.startError)} />}
      <Button
        label={pre.starting ? texts.starting : texts.start}
        disabled={blocker !== null || reading || pre.starting}
        onPress={pre.start}
      />
    </>
  );
}

/** Sheet 08 (PreJogo.dc.html) over screen 07: "Fechar" goes back to the draw as it was (D1, D6). */
export function PreGameSheet({
  groupId,
  roundId,
  model,
  arrangement,
  settings,
  leftSinceDraw,
}: PreGameSheetProps) {
  const pre = usePreGame({
    groupId,
    roundId,
    state: model.state,
    dispatch: model.dispatch,
    arrangement,
    settings,
    members: model.members,
  });
  const close = () => {
    model.dispatch({ type: "pre-game-closed" });
  };
  const base = settings.scoring.pointsPerSet;
  return (
    <BottomSheet
      visible={model.state.sheet === "pre-game"}
      title={texts.title(matchNumber(courtOf(pre.court)))}
      closeLabel={texts.close}
      onClose={close}
    >
      <Teams />
      <PointsStepper
        label={texts.points}
        lessLabel={texts.lessPoints}
        moreLabel={texts.morePoints}
        view={pointsView(pre.input)}
        onStep={(delta) => {
          model.dispatch({ type: "points-stepped", delta, base });
        }}
      />
      <SetsSection pre={pre} model={model} />
      <ServerSection pre={pre} model={model} />
      <RotationSection pre={pre} model={model} />
      <StartButton pre={pre} leftSinceDraw={leftSinceDraw} />
    </BottomSheet>
  );
}
