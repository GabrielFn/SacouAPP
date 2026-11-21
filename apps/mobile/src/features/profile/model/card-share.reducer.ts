import type { CaptureError, ImageShareError, SaveError } from "../ports/card-image";

export type CardShareFailure = CaptureError | ImageShareError | SaveError;
export type CardShareIntent = "share" | "save";

/** The local state of the card export (frontend.md, rule 4). `saved` is the "Salvo" confirmation. */
export type CardShareState =
  | { readonly status: "idle" }
  | { readonly status: "capturing"; readonly intent: CardShareIntent }
  | { readonly status: "sharing" }
  | { readonly status: "saving" }
  | { readonly status: "saved" }
  | { readonly status: "failed"; readonly reason: CardShareFailure };

export type CardShareAction =
  | { readonly type: "share-requested" }
  | { readonly type: "save-requested" }
  | { readonly type: "captured" }
  | { readonly type: "shared" }
  | { readonly type: "saved" }
  | { readonly type: "failed"; readonly reason: CardShareFailure }
  | { readonly type: "dismissed" };

export const initialCardShareState: CardShareState = { status: "idle" };

/** A capture, a share sheet or a save is running: a new tap is ignored. */
export function isBusy(state: CardShareState): boolean {
  return state.status === "capturing" || state.status === "sharing" || state.status === "saving";
}

function request(state: CardShareState, intent: CardShareIntent): CardShareState {
  return isBusy(state) ? state : { status: "capturing", intent };
}

function finish(
  state: CardShareState,
  from: CardShareState["status"],
  next: CardShareState,
): CardShareState {
  return state.status === from ? next : state;
}

function captured(state: CardShareState): CardShareState {
  if (state.status !== "capturing") return state;
  return state.intent === "share" ? { status: "sharing" } : { status: "saving" };
}

export function cardShareReducer(state: CardShareState, action: CardShareAction): CardShareState {
  switch (action.type) {
    case "share-requested":
      return request(state, "share");
    case "save-requested":
      return request(state, "save");
    case "captured":
      return captured(state);
    case "shared":
      return finish(state, "sharing", initialCardShareState);
    case "saved":
      return finish(state, "saving", { status: "saved" });
    case "failed":
      return isBusy(state) ? { status: "failed", reason: action.reason } : state;
    case "dismissed":
      return initialCardShareState;
  }
}
