import type { Href } from "expo-router";
import { View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import type { DrawScreenModel } from "../hooks/use-draw-screen";
import type { DrawArrangement } from "../model/draw-arrangement";
import { meterView } from "../model/draw-meter";
import { staleDraw } from "../model/draw-request";
import { blockerOfError } from "../model/draw-screen-state";
import {
  drawTitle,
  footerHint,
  lockButton,
  noticeText,
  reserveChips,
  teamCards,
} from "../model/draw-view";
import { BalanceMeter } from "./BalanceMeter";
import { DrawFooter } from "./DrawFooter";
import { DrawHeader } from "./DrawHeader";
import { DrawTeamCard } from "./DrawTeamCard";
import { ReservesRow } from "./ReservesRow";

const { draw } = strings;
const FADED = 0.5;

export interface DrawnViewProps {
  readonly model: DrawScreenModel;
  readonly arrangement: DrawArrangement;
  readonly round: Round;
  readonly header: string;
  readonly backHref: Href;
}

/** The strips over the teams: who left or arrived since the draw, the refused draw, the local notice. */
function DrawStrips({ model, arrangement, round }: Omit<DrawnViewProps, "header" | "backHref">) {
  const stale = staleDraw(arrangement, round);
  const [firstLeft] = stale.left;
  const refusal =
    model.error !== null && blockerOfError(model.error) === null
      ? errorTextOf(model.error)
      : null;
  const notice = noticeText(model.state.notice, model.nameOf);
  return (
    <>
      {firstLeft === undefined ? null : (
        <ErrorStrip text={draw.stale.left(model.nameOf(firstLeft), stale.left.length - 1)} />
      )}
      {stale.arrived === 0 ? null : <ErrorStrip text={draw.stale.arrived(stale.arrived)} />}
      {refusal === null ? null : <ErrorStrip text={refusal} />}
      {notice === null ? null : <ErrorStrip text={notice} />}
      {model.pending ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {draw.redrawing}
        </Text>
      ) : null}
    </>
  );
}

/** Screen 07 with the teams (Sorteio.dc.html): meter, cards, reserves and the footer. */
export function DrawnView({ model, arrangement, round, header, backHref }: DrawnViewProps) {
  const { tokens } = useTheme();
  const { state, nameOf, pending } = model;
  const meter = meterView(arrangement);
  const reserves = reserveChips(state, arrangement, nameOf);
  const stale = staleDraw(arrangement, round);
  const footer = (
    <DrawFooter
      hint={footerHint(state, nameOf)}
      mode={state.mode}
      lockAction={lockButton(state)}
      busy={pending}
      online={model.online}
      canConfirm={stale.left.length === 0}
      onSwap={() => {
        model.dispatch({ type: "swap-mode-chosen" });
      }}
      onLock={() => {
        model.dispatch({ type: "lock-mode-chosen" });
      }}
      onUnlock={() => {
        model.dispatch({ type: "unlock-chosen" });
      }}
      onRedraw={model.redraw}
      onConfirm={model.share}
    />
  );
  return (
    <Screen footer={footer}>
      <DrawHeader header={header} title={drawTitle(arrangement)} backHref={backHref} />
      <DrawStrips model={model} arrangement={arrangement} round={round} />
      <View style={{ gap: tokens.spacing.s, opacity: pending ? FADED : 1 }}>
        {meter === null ? null : <BalanceMeter meter={meter} />}
        {teamCards(state, arrangement, nameOf).map((card) => (
          <DrawTeamCard key={card.team.letter} card={card} disabled={pending} onTap={model.tap} />
        ))}
        <ReservesRow reserves={reserves} disabled={pending} onTap={model.tap} />
      </View>
      <Text variant="caption">{draw.privacy}</Text>
    </Screen>
  );
}
