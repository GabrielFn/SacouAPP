/** The invite this phone created for a group: the token is shown again without asking the server. */
export interface StoredInviteLink {
  readonly inviteId: string;
  readonly token: string;
}

/**
 * Where the token of an invite lives on the phone, and the only place (ADR 0049, D7): never the query
 * cache, a reducer, a route parameter nor a log. The real one is the encrypted store of the system.
 */
export interface InviteLinkStore {
  read(groupId: string): Promise<StoredInviteLink | null>;
  save(groupId: string, link: StoredInviteLink): Promise<void>;
  remove(groupId: string): Promise<void>;
  /** Sign-out forgets every group's link (`clearSession`). */
  clearAll(): Promise<void>;
}
