import type { ApiOutcome } from "../round-page/ports";

import type { InvitePreview } from "./invite-page.types";

/** The invite routes of the API (ADR 0040, D10): the token always in the JSON body, never in the path nor the query. */
export interface InviteApiPort {
  /** `POST /v1/me`: the preview and the accept refuse whoever is not registered. */
  register(): Promise<ApiOutcome<null>>;
  /** `POST /v1/invites/preview` `{ token }`. */
  preview(token: string): Promise<ApiOutcome<InvitePreview>>;
  /** `POST /v1/invites/accept` `{ token }`: 201 for who came in, 200 for who was in already. */
  accept(token: string): Promise<ApiOutcome<null>>;
}
