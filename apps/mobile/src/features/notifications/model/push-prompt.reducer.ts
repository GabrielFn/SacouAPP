/**
 * The offer of the notifications after a first "VOU" or a first round created (R98, item 9, question
 * 1): nothing yet, reading whether it is due, the sentence on screen, the system question on screen,
 * or over for this run (shown, refused, given or not due). Once over it never starts again.
 */
export type PushPromptState = "idle" | "checking" | "offering" | "asking" | "done";

export type PushPromptAction =
  | { readonly type: "offer-requested" }
  | { readonly type: "checked"; readonly due: boolean }
  | { readonly type: "accepted" }
  | { readonly type: "declined" }
  | { readonly type: "answered" };

export const INITIAL_PUSH_PROMPT: PushPromptState = "idle";

/** Each action moves only from its own state; anywhere else it changes nothing. */
const MOVES: Readonly<
  Record<Exclude<PushPromptAction["type"], "checked">, readonly [PushPromptState, PushPromptState]>
> = {
  "offer-requested": ["idle", "checking"],
  accepted: ["offering", "asking"],
  declined: ["offering", "done"],
  answered: ["asking", "done"],
};

function move(state: PushPromptState, [from, to]: readonly [PushPromptState, PushPromptState]) {
  return state === from ? to : state;
}

/** Pure and with no effect: the reads, the system question and the registration are the hook's. */
export function pushPromptReducer(
  state: PushPromptState,
  action: PushPromptAction,
): PushPromptState {
  switch (action.type) {
    case "checked":
      return move(state, ["checking", action.due ? "offering" : "done"]);
    case "offer-requested":
    case "accepted":
    case "declined":
    case "answered":
      return move(state, MOVES[action.type]);
  }
}

/** The sentence shows only before the system question; while the system asks, its dialog is on top. */
export function showsPushPrompt(state: PushPromptState): boolean {
  return state === "offering";
}
