import type { MemberId, TeamSide } from "@sacou/match-engine";

/**
 * What screen 11 decides before "Confirmar" and must not lose if the app closes (pendência 22): the
 * shuffle of each team for the criterion `draw`, made once per finished match, and the players
 * picked by hand for the criterion `manual`. Only `MemberId`s.
 */
export interface NextMatchDraft {
  readonly drawOrder: Readonly<Record<TeamSide, readonly MemberId[]>> | null;
  readonly chosen: Readonly<Record<TeamSide, readonly MemberId[]>>;
}

export const EMPTY_NEXT_MATCH_DRAFT: NextMatchDraft = { drawOrder: null, chosen: { a: [], b: [] } };

/** The draft of the next match, one per finished match, kept on the phone until it starts. */
export interface NextMatchDraftStore {
  /** `null` when there is none or what is stored does not read as a draft. */
  load(matchId: string): Promise<NextMatchDraft | null>;
  save(matchId: string, draft: NextMatchDraft): Promise<void>;
  clear(matchId: string): Promise<void>;
}
