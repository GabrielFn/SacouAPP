import type { GroupRole } from "../../../services/api/sacou-api";

const DRAWING_ROLES: ReadonlySet<GroupRole> = new Set(["admin", "coAdmin"]);

/** The `DrawTeams` capability of the server (ADR 0055): only admin and co-admin draw the teams. */
export function canDraw(role: GroupRole): boolean {
  return DRAWING_ROLES.has(role);
}
