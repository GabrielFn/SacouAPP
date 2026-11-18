import type { CourtSessionTimeline, MemberId, PointAuthorship } from "@sacou/match-engine";
import { useCallback, useMemo, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import { attributionSheet, type AttributionSheetModel } from "../attribution/attribution-selectors";
import {
  attributionReducer,
  CLOSED_ATTRIBUTION,
  type AuthoredPointKind,
} from "../attribution/attribution.reducer";
import { refusalText } from "../model/refusal-text";
import type { PlayCommand } from "../session/command-drafts";
import type { CommandResult } from "../session/court-session-controller";

export interface AttributionSheetHandle {
  /** `null` while closed, or when the point it asks about left the open match. */
  readonly model: AttributionSheetModel | null;
  /** Asks about these points, in order; an empty list closes the sheet. */
  readonly open: (pointEventIds: readonly string[]) => void;
  readonly onChooseKind: (kind: AuthoredPointKind) => void;
  readonly onAuthor: (memberId: MemberId) => void;
  readonly onOpponentError: () => void;
  readonly onSkip: () => void;
}

/**
 * Screen 31 for a route of the court: the reducer of the sheet and the answers as commands. Only an
 * answer writes (`attribute-point`); "Pular" and a new point write nothing (placar.md). A refusal is
 * a sentence on the sheet, never a buzz.
 */
export function useAttributionSheet(
  timeline: CourtSessionTimeline | null,
  dispatch: (command: PlayCommand) => Promise<CommandResult>,
): AttributionSheetHandle {
  const { courtRoster } = useServices();
  const [state, send] = useReducer(attributionReducer, CLOSED_ATTRIBUTION);
  const model = useMemo(
    () => (timeline === null ? null : attributionSheet(timeline, courtRoster, state)),
    [timeline, courtRoster, state],
  );
  const pointEventId = model?.pointEventId ?? null;
  const record = useCallback(
    (authorship: PointAuthorship) => {
      if (pointEventId === null) {
        return;
      }
      void dispatch({ type: "attribute-point", pointEventId, authorship }).then((result) => {
        send(
          result.ok
            ? { type: "answered" }
            : { type: "command-refused", text: refusalText(result.error) },
        );
      });
    },
    [dispatch, pointEventId],
  );
  const kind = state.status === "open" ? state.kind : null;
  return {
    model,
    open: useCallback((pointEventIds: readonly string[]) => {
      send({ type: "opened", pointEventIds });
    }, []),
    onChooseKind: useCallback((chosen: AuthoredPointKind) => {
      send({ type: "kind-chosen", kind: chosen });
    }, []),
    onAuthor: useCallback(
      (author: MemberId) => {
        if (kind !== null) {
          record({ kind, author });
        }
      },
      [kind, record],
    ),
    onOpponentError: useCallback(() => {
      record({ kind: "opponent-error", author: null });
    }, [record]),
    onSkip: useCallback(() => {
      send({ type: "skipped" });
    }, []),
  };
}
