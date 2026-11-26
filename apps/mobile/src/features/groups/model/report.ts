import type { ContentReportBody, Member, ReportReason } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";

const texts = strings.report;

/** The four reasons, in the order the sheet shows them (question 233). No "other": no free text. */
export const REPORT_REASONS: readonly ReportReason[] = [
  "offensiveName",
  "hateOrSexual",
  "impersonation",
  "spam",
];

/** Whom the report is about: a member of the list (sheet 19c) or the group itself (screen 18). */
export type ReportTarget =
  | { readonly kind: "member"; readonly memberId: string; readonly name: string }
  | { readonly kind: "group" };

/** What a screen with "Denunciar" hands to its sheet: who is reported and the status of the call (E6.6). */
export interface ReportFlow {
  /** Whom the open sheet reports; `null` when it is closed. */
  readonly target: ReportTarget | null;
  readonly pending: boolean;
  readonly errorText: string | null;
  /** The last report went through: "Denúncia enviada" shows until the next one starts. */
  readonly sent: boolean;
  readonly send: (reason: ReportReason) => void;
}

/**
 * "Denunciar grupo" at the end of screen 18 (E6.6, criterion 13): for every active member but the only admin, who
 * wrote the name and the venue and changes them instead. Hidden until the members are known.
 */
export function canReportGroup(members: readonly Member[] | undefined): boolean {
  const me = members?.find((member) => member.isMe);
  if (members === undefined || me === undefined) return false;
  const admins = members.filter((member) => member.role === "admin").length;
  return !(me.role === "admin" && admins <= 1);
}

export function reportTitle(target: ReportTarget): string {
  return target.kind === "member" ? texts.memberTitle(target.name) : texts.groupTitle;
}

export function reasonLabel(reason: ReportReason): string {
  return texts.reasons[reason];
}

/** The body of the route: the member id, or `null` for the group. Never a name nor a text. */
export function reportBody(target: ReportTarget, reason: ReportReason): ContentReportBody {
  return { reportedMemberId: target.kind === "member" ? target.memberId : null, reason };
}
