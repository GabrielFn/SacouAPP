import { strings } from "../../../strings/pt-BR";
import type { TeamPanelModel } from "./court-screen.types";

/** What a screen reader says for the team zone, which is a button that scores for the team. */
export function zoneLabel(panel: TeamPanelModel): string {
  return strings.court.zone.pointFor({
    team: panel.label,
    score: panel.score,
    setPoint: panel.hasSetPoint,
    serving: panel.isServing,
    serverName: panel.serverName,
  });
}
