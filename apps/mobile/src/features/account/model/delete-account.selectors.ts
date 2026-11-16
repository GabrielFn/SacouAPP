import type { DeletionBlocker } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";

const texts = strings.account.deleteScreen;

/** "EXCLUIR", trimmed and in any case ("excluir" counts; "EXCLUI" does not), ADR 0057. */
export function confirmMatches(text: string): boolean {
  return text.trim().toLocaleUpperCase("pt-BR") === texts.confirmWord;
}

/** The yellow notice: the first group by name and how many more (the API sorts them by name). */
export interface BlockerNotice {
  /** `null` when the group has no name to show: "de um grupo", never the ID. */
  readonly groupName: string | null;
  readonly others: number;
  /** "Escolher outro admin" opens the members of this group (screen 19). */
  readonly firstGroupId: string;
}

export function blockerNotice(blockers: readonly DeletionBlocker[]): BlockerNotice | null {
  const [first, ...rest] = blockers;
  if (first === undefined) return null;
  const name = first.groupName.trim();
  return {
    groupName: name === "" ? null : name,
    others: rest.length,
    firstGroupId: first.groupId,
  };
}

/** The notice as one sentence, for the screen reader and the tests. */
export function blockerSentence(notice: BlockerNotice): string {
  const group =
    notice.groupName === null ? texts.blockerUnnamed : `${texts.blockerOfNamed}${notice.groupName}`;
  const more = notice.others > 0 ? texts.blockerMore(notice.others) : "";
  return `${texts.blockerStart}${group}${more}${texts.blockerEnd}`;
}

export interface CanDeleteInput {
  readonly confirmText: string;
  /** `undefined` until the preview arrives (or when it failed): nothing is known, so no. */
  readonly blockers: readonly DeletionBlocker[] | undefined;
  readonly pending: boolean;
  /** An e-mail account asked to log in again: the password must be typed too. */
  readonly asksForPassword: boolean;
  readonly password: string;
}

/** The red button: the word typed, the preview read and empty, and no deletion running. */
export function canDelete(input: CanDeleteInput): boolean {
  const { confirmText, blockers, pending } = input;
  const passwordReady = !input.asksForPassword || input.password !== "";
  return (
    !pending &&
    passwordReady &&
    blockers !== undefined &&
    blockers.length === 0 &&
    confirmMatches(confirmText)
  );
}
