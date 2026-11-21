import { useEffect, useReducer, useRef, useState } from "react";

import { useServices } from "../../../services/services-context";
import { createSingleFlight } from "../../account/model/single-flight";
import {
  cardShareReducer,
  initialCardShareState,
  type CardShareAction,
  type CardShareIntent,
  type CardShareState,
} from "../model/card-share.reducer";
import { runCardShare } from "../model/run-card-share";
import type { CaptureTarget } from "../ports/card-image";

export interface CardShareModel {
  readonly state: CardShareState;
  readonly share: () => void;
  readonly save: () => void;
  readonly dismiss: () => void;
  readonly openSettings: () => void;
}

/** The export of the card: the reducer holds the state, the ports do the work. */
export function useCardShare(target: CaptureTarget): CardShareModel {
  const { cardCapture, imageShare, gallerySaver } = useServices();
  const [state, dispatch] = useReducer(cardShareReducer, initialCardShareState);
  // A second tap in the same frame joins the first run (the reducer sees it only on the next render).
  const [flight] = useState(() => createSingleFlight<null>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const safeDispatch = (action: CardShareAction) => {
    if (mounted.current) dispatch(action);
  };
  const run = (intent: CardShareIntent) => {
    dispatch({ type: intent === "share" ? "share-requested" : "save-requested" });
    void flight.run(async () => {
      await runCardShare(
        intent,
        target,
        { capture: cardCapture, imageShare, gallery: gallerySaver },
        safeDispatch,
      );
      return null;
    });
  };
  return {
    state,
    share: () => {
      run("share");
    },
    save: () => {
      run("save");
    },
    dismiss: () => {
      dispatch({ type: "dismissed" });
    },
    openSettings: () => {
      void gallerySaver.openSettings();
    },
  };
}
